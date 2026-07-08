const LMProfileStore = (() => {
  const USERS_KEY = 'lm_users';
  const CURRENT_KEY = 'lm_currentUser';
  const LEGACY_USER_KEY = 'lm_user';
  const LEGACY_PROGRESS_KEY = 'lm_progress';

  const safeParse = (value, fallback = null) => {
    try { return value ? JSON.parse(value) : fallback; }
    catch (e) { return fallback; }
  };

  const userKey = (name = '') => String(name).trim().toLowerCase();

  const blankProgress = () => ({
    tutorialCompleted: false,
    unlockedPhases: [1],
    collectedEvidence: [],
    answers: [],
    fieldNotes: {},
    finalReview: null,
    badges: []
  });

  const ensureProgress = (progress = {}) => {
    const base = blankProgress();
    const source = progress && typeof progress === 'object' ? progress : {};
    return {
      ...base,
      ...source,
      unlockedPhases: Array.isArray(source.unlockedPhases) && source.unlockedPhases.length ? source.unlockedPhases : [1],
      collectedEvidence: Array.isArray(source.collectedEvidence) ? source.collectedEvidence : [],
      answers: Array.isArray(source.answers) ? source.answers : [],
      fieldNotes: source.fieldNotes && typeof source.fieldNotes === 'object' && !Array.isArray(source.fieldNotes) ? source.fieldNotes : {},
      finalReview: source.finalReview || null,
      badges: Array.isArray(source.badges) ? source.badges : []
    };
  };

  const normalizeUser = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || raw.username || '').trim();
    if (!name) return null;
    const knowledgeLevel = String(raw.knowledgeLevel || raw.level || '3');
    const ageGroup = raw.ageGroup || raw.age || '';

    return {
      ...raw,
      name,
      username: name,
      fullName: raw.fullName || raw.fullname || name,
      password: raw.password || '',
      knowledgeLevel,
      level: knowledgeLevel,
      ageGroup,
      age: ageGroup,
      gender: raw.gender || '',
      location: raw.location || '',
      occupation: raw.occupation || '',
      avatar: raw.avatar || 'bertha',
      progress: ensureProgress(raw.progress)
    };
  };

  const readUsers = () => {
    const raw = safeParse(localStorage.getItem(USERS_KEY), {});
    const users = {};

    if (Array.isArray(raw)) {
      raw.forEach(user => {
        const normalized = normalizeUser(user);
        if (normalized) users[userKey(normalized.name)] = normalized;
      });
      return users;
    }

    Object.values(raw || {}).forEach(user => {
      const normalized = normalizeUser(user);
      if (normalized) users[userKey(normalized.name)] = normalized;
    });

    return users;
  };

  const writeUsers = (users) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const setCurrentUser = (user) => {
    const normalized = normalizeUser(user);
    if (!normalized) return null;

    const users = readUsers();
    users[userKey(normalized.name)] = normalized;
    writeUsers(users);

    localStorage.setItem(CURRENT_KEY, JSON.stringify(normalized));
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(LEGACY_PROGRESS_KEY);

    return normalized;
  };

  const getCurrentUser = () => {
    let current = normalizeUser(safeParse(localStorage.getItem(CURRENT_KEY), null));

    if (!current) {
      const legacyUser = normalizeUser(safeParse(localStorage.getItem(LEGACY_USER_KEY), null));
      if (legacyUser) current = setCurrentUser(legacyUser);
    }

    if (!current) return null;

    const users = readUsers();
    const stored = users[userKey(current.name)];
    return stored ? normalizeUser(stored) : current;
  };

  const clearCurrentUser = () => {
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(LEGACY_PROGRESS_KEY);
  };

  const register = (payload) => {
    const normalized = normalizeUser({ ...payload, progress: blankProgress() });
    if (!normalized) throw new Error('missing-user');

    const users = readUsers();
    if (users[userKey(normalized.name)]) throw new Error('duplicate-user');

    return setCurrentUser(normalized);
  };

  const login = (name, password) => {
    const key = userKey(name);
    const users = readUsers();
    const storedKey = Object.keys(users).find(existingKey => existingKey === key);
    if (!storedKey) throw new Error('missing-user');

    const user = normalizeUser(users[storedKey]);
    if (user.password !== password) throw new Error('bad-password');

    return setCurrentUser(user);
  };

  const updateCurrentUser = (payload) => {
    const current = getCurrentUser();
    if (!current) throw new Error('missing-session');

    return setCurrentUser({
      ...current,
      ...payload,
      name: current.name,
      username: current.name,
      password: payload.password || current.password,
      progress: current.progress
    });
  };

  const saveProgress = (progress) => {
    const current = getCurrentUser();
    if (!current) return null;
    return setCurrentUser({ ...current, progress: ensureProgress(progress) });
  };

  const resetCurrentProgress = () => {
    const current = getCurrentUser();
    if (!current) return null;
    return setCurrentUser({ ...current, progress: blankProgress() });
  };

  const deleteCurrentUser = () => {
    const current = getCurrentUser();
    if (!current) return false;

    const users = readUsers();
    delete users[userKey(current.name)];
    writeUsers(users);
    clearCurrentUser();
    return true;
  };

  const saveReview = (review) => {
    const current = getCurrentUser();
    if (!current) throw new Error('missing-session');
    const progress = ensureProgress(current.progress);
    progress.finalReview = review;
    return setCurrentUser({ ...current, progress });
  };

  const saveAnswer = (answer) => {
    const current = getCurrentUser();
    if (!current) return null;

    const progress = ensureProgress(current.progress);
    const nextAnswer = {
      phaseNum: answer.phaseNum,
      title: answer.title,
      question: answer.question,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: !!answer.isCorrect,
      answeredAt: new Date().toISOString()
    };

    const existingIndex = progress.answers.findIndex(item => item.phaseNum === nextAnswer.phaseNum);
    if (existingIndex >= 0) progress.answers[existingIndex] = nextAnswer;
    else progress.answers.push(nextAnswer);

    return setCurrentUser({ ...current, progress });
  };

  return {
    blankProgress,
    ensureProgress,
    normalizeUser,
    readUsers,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    register,
    login,
    updateCurrentUser,
    saveProgress,
    resetCurrentProgress,
    deleteCurrentUser,
    saveReview,
    saveAnswer
  };
})();

const LMRating = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const starPath = 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

  const ensureGradient = () => {
    if (document.getElementById('halfGradient')) return;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <defs>
        <linearGradient id="halfGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stop-color="#93585E"></stop>
          <stop offset="50%" stop-color="#F9F6F0"></stop>
        </linearGradient>
      </defs>`;
    document.body.prepend(svg);
  };

  const formatRating = (value) => Number(value).toFixed(1).replace('.', ',');

  const init = (target, options = {}) => {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) return null;

    ensureGradient();

    let value = Number(options.initialValue || 0);
    let previewValue = null;
    const badge = document.getElementById(options.badgeId || 'starValue');
    let input = document.getElementById(options.inputId || 'ratingValue');

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.id = options.inputId || 'ratingValue';
      input.value = '0';
      container.insertAdjacentElement('afterend', input);
    }

    const paint = (displayValue) => {
      const shown = Math.max(0, Math.min(5, Number(displayValue) || 0));

      container.querySelectorAll('.star-svg').forEach(star => {
        const index = Number(star.dataset.index);
        star.classList.toggle('filled', shown >= index);
        star.classList.toggle('half-filled', shown >= index - 0.5 && shown < index);
      });
    };

    const update = (nextValue) => {
      value = Math.max(0, Math.min(5, Number(nextValue) || 0));
      previewValue = null;
      input.value = String(value);
      container.setAttribute('aria-valuenow', String(value));
      if (badge) badge.innerText = `Nota: ${formatRating(value)} / 5`;

      paint(value);

      if (typeof options.onChange === 'function') options.onChange(value);
    };

    container.innerHTML = '';
    for (let index = 1; index <= 5; index++) {
      const star = document.createElementNS(SVG_NS, 'svg');
      star.setAttribute('viewBox', '0 0 24 24');
      star.setAttribute('role', 'button');
      star.setAttribute('tabindex', '0');
      star.setAttribute('aria-label', `${index} estrela${index > 1 ? 's' : ''}`);
      star.classList.add('star-svg', 'star');
      star.dataset.index = String(index);
      star.dataset.value = String(index);

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', starPath);
      star.appendChild(path);

      const valueFromPointer = (event) => {
        const rect = star.getBoundingClientRect();
        const half = event.clientX - rect.left < rect.width * 0.35 ? 0.5 : 1;
        return index - 1 + half;
      };

      const selectFromPointer = (event) => {
        update(valueFromPointer(event));
      };

      star.addEventListener('click', selectFromPointer);
      star.addEventListener('mousemove', (event) => {
        previewValue = valueFromPointer(event);
        paint(previewValue);
        if (badge) badge.innerText = `Nota: ${formatRating(previewValue)} / 5`;
      });
      star.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          update(index);
        }
      });

      container.appendChild(star);
    }

    container.addEventListener('mouseleave', () => {
      previewValue = null;
      paint(value);
      if (badge) badge.innerText = `Nota: ${formatRating(value)} / 5`;
    });

    container.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        update(value + 0.5);
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        update(value - 0.5);
      }
    });

    update(value);
    return { getValue: () => value, setValue: update };
  };

  return { init };
})();

window.LMProfileStore = LMProfileStore;
window.LMRating = LMRating;

const Game = {
  state: {
    user: null,
    isGameCompleted: false, 
    rating: 0,
    avatars: {
      'bertha': '<img src="assets/bertha.png" alt="Bertha Lutz">',
      'celina': '<img src="assets/celina.png" alt="Celina Guimarães">',
      'leolinda': '<img src="assets/leolinda.png" alt="Leolinda Daltro">',
      'mietta': '<img src="assets/mietta.png" alt="Mietta Santiago">'
    }
  },

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadUser();
    this.setup3D();
    this.renderStars();
  },

  cacheDOM() {
    this.menuBtn = document.getElementById('menuBtn');
    this.closeMenuBtn = document.getElementById('closeMenuBtn');
    this.fullMenu = document.getElementById('fullMenu');
    this.modalOverlay = document.getElementById('modalOverlay');
    this.modals = document.querySelectorAll('.modal');
    this.playerName = document.getElementById('playerName');
    this.headerAvatar = document.getElementById('headerAvatar');
    this.headerAuthBtn = document.getElementById('headerAuthBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.dossier = document.getElementById('dossier3d');
    this.stampBtn = document.getElementById('stampBtn');
    this.stampMark = document.getElementById('stampMark');
  },

  bindEvents() {
    // Menu
    if(this.menuBtn) this.menuBtn.addEventListener('click', () => this.fullMenu.classList.add('active'));
    if(this.closeMenuBtn) this.closeMenuBtn.addEventListener('click', () => this.fullMenu.classList.remove('active'));

    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    if(this.modalOverlay) {
      this.modalOverlay.addEventListener('click', (e) => {
        if(e.target === this.modalOverlay) this.closeAllModals();
      });
    }

    // Abas de Login
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const tabProfile = document.getElementById('tabProfile');
    const loginForm = document.getElementById('loginForm');
    const profileForm = document.getElementById('profileForm');

    if(tabLogin) tabLogin.addEventListener('click', () => this.switchAuthTab('login'));
    if(tabRegister) tabRegister.addEventListener('click', () => this.switchAuthTab('register'));
    if(tabProfile) tabProfile.addEventListener('click', () => this.switchAuthTab('profile'));

    // Teclado Avatares
    document.querySelectorAll('.avatar-option').forEach(label => {
      label.addEventListener('keydown', (e) => {
        if(e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const radio = label.querySelector('input[type="radio"]');
          if(radio) {
            radio.checked = true;
            this.updateAvatarBio(radio.value);
          }
        }
      });
    });
    document.querySelectorAll('input[name="p_avatar"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateAvatarBio(radio.value));
    });

    if(profileForm) profileForm.addEventListener('submit', (e) => this.saveProfile(e));
    if(loginForm) loginForm.addEventListener('submit', (e) => this.loginUser(e));
    
    const reviewForm = document.getElementById('reviewForm');
    if(reviewForm) reviewForm.addEventListener('submit', (e) => this.saveReview(e));
    
    if(this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.logout());
    if(this.headerAuthBtn) this.headerAuthBtn.addEventListener('click', () => this.openModal('profile'));
    document.getElementById('editProfileBtn')?.addEventListener('click', () => this.switchAuthTab('edit'));
    document.getElementById('resetProgressBtn')?.addEventListener('click', () => this.resetProgress());
    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.deleteAccount());

    if(this.stampBtn) {
      this.stampBtn.addEventListener('click', () => {
        if(!this.state.user) {
          this.showToast("Crie sua credencial primeiro!");
          this.openModal('profile');
          return;
        }
        this.applyStamp();
      });
    }

    const testBtn = document.getElementById('testCompleteBtn');
    if(testBtn) {
      testBtn.addEventListener('click', () => {
        this.state.isGameCompleted = !this.state.isGameCompleted;
        testBtn.innerText = this.state.isGameCompleted ? "Modo Teste: Reverter" : "Modo Teste: Concluir";
        testBtn.style.backgroundColor = this.state.isGameCompleted ? "var(--sage)" : "";
        testBtn.style.color = this.state.isGameCompleted ? "var(--charcoal)" : "";
        this.showToast(this.state.isGameCompleted ? "Jogo marcado como CONCLUÍDO." : "Jogo marcado como PENDENTE.");
      });
    }
    
    // INICIAR INVESTIGAÇÃO (COM VIAGEM NO TEMPO RESTAURADA)
    const startBtn = document.getElementById('startBtn');
    if(startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const localUser = LMProfileStore.getCurrentUser();
        if(!this.state.user && !localUser) {
          this.showToast("Acesso Restrito: Identifique-se no Arquivo primeiro.");
          this.openModal('profile');
          return;
        }
        
        // Cria a sobreposição do túnel do tempo
        const overlay = document.createElement('div');
        overlay.id = 'timeTravelOverlay';
        overlay.innerHTML = `<div class="time-tunnel"></div><div class="year-counter" id="yearCounter">2026</div>`;
        document.body.appendChild(overlay);

        setTimeout(() => {
          overlay.classList.add('active');
          const counterEl = document.getElementById('yearCounter');
          let startYear = 2026, endYear = 1933, duration = 2800, startTime = null; // Vai pra 1933!

          const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            counterEl.innerText = Math.floor(startYear - ((startYear - endYear) * easeOut));

            // Efeito de tremor
            if(progress > 0.3 && progress < 0.9) {
              counterEl.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px) scale(1.2)`;
            } else {
              counterEl.style.transform = `scale(1.5)`;
            }

            if (progress < 1) window.requestAnimationFrame(step);
            else {
              counterEl.innerText = endYear;
              overlay.classList.add('blackout');
              setTimeout(() => window.location.href = 'game.html', 800);
            }
          };
          window.requestAnimationFrame(step);
        }, 50);
      });
    }

    document.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if(['input', 'textarea', 'select'].includes(tag)) return;

      if (e.key === 'Escape') {
        this.closeAllModals();
        if(this.fullMenu) this.fullMenu.classList.remove('active');
        return;
      }

      const key = e.key.toLowerCase();
      if(key === 'm') {
        e.preventDefault();
        if(this.fullMenu) this.fullMenu.classList.toggle('active');
      } else if(key === 'p') {
        e.preventDefault();
        this.openModal('profile');
      }
    });
  },

  getBadgeCatalog() {
    return [
      { id: 'primeira-pista', icon: 'I', title: 'Primeira pista', text: 'Abriu o arquivo e iniciou a investigação.', threshold: 2 },
      { id: 'linha-do-tempo', icon: 'II', title: 'Linha em ordem', text: 'Reconstruiu os primeiros marcos do voto feminino.', threshold: 4 },
      { id: 'leitora-de-atas', icon: 'III', title: 'Leitora de atas', text: 'Avançou até os registros locais e documentos oficiais.', threshold: 7 },
      { id: 'voz-do-arquivo', icon: 'IV', title: 'Voz do arquivo', text: 'Comparou falas, jornais e disputas de memória.', threshold: 12 },
      { id: 'guardia-da-memoria', icon: 'V', title: 'Guardiã da memória', text: 'Chegou perto de completar o dossiê histórico.', threshold: 18 }
    ];
  },

  getAvatarCatalog() {
    return {
      bertha: {
        name: 'Bertha Lutz',
        role: 'A Cientista',
        bio: 'Bióloga e líder sufragista, ajudou a fundar a Federação Brasileira pelo Progresso Feminino e articulou a campanha nacional pelo voto das mulheres.'
      },
      celina: {
        name: 'Celina Guimarães Viana',
        role: 'A Primeira',
        bio: 'Professora potiguar, ficou conhecida como a primeira eleitora do Brasil ao se alistar em 1927, abrindo uma brecha decisiva na luta pelo voto feminino.'
      },
      leolinda: {
        name: 'Leolinda Daltro',
        role: 'A Professora',
        bio: 'Educadora e ativista, fundou o Partido Republicano Feminino em 1910 e levou a defesa dos direitos políticos das mulheres para a vida pública.'
      },
      mietta: {
        name: 'Mietta Santiago',
        role: 'A Escritora',
        bio: 'Advogada, escritora e sufragista mineira, recorreu à Justiça em 1928 para garantir o direito de votar e disputar eleições.'
      }
    };
  },

  updateAvatarBio(value = null) {
    const selected = value || document.querySelector('input[name="p_avatar"]:checked')?.value || 'bertha';
    const info = this.getAvatarCatalog()[selected];
    const bio = document.getElementById('avatarBio');
    if(!bio || !info) return;
    bio.innerHTML = `<strong>${info.name}</strong><span>${info.role}</span><p>${info.bio}</p>`;
  },

  getUnlockedBadgeIds(progress = {}) {
    const unlocked = Array.isArray(progress.unlockedPhases) ? progress.unlockedPhases : [1];
    const highest = Math.max(...unlocked, 1);
    return this.getBadgeCatalog().filter(badge => highest >= badge.threshold).map(badge => badge.id);
  },

  getBadgeProgress(progress = {}, badge, index) {
    const unlocked = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
    const highest = Math.max(...unlocked, 1);
    const previous = index === 0 ? 1 : this.getBadgeCatalog()[index - 1].threshold;
    const span = Math.max(1, badge.threshold - previous);
    const fill = Math.max(0, Math.min(100, Math.round(((highest - previous) / span) * 100)));
    return {
      fill,
      state: fill >= 100 ? 'unlocked' : fill > 0 ? 'partial' : 'locked'
    };
  },

  getProfileRank(progress = {}) {
    const catalog = this.getBadgeCatalog();
    const unlocked = this.getUnlockedBadgeIds(progress);
    return catalog.find(item => item.id === unlocked[unlocked.length - 1]) || { icon: '0', title: 'Arquivo inicial' };
  },

  getAvatarRankFill(progress = {}) {
    const unlocked = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
    const highest = Math.max(...unlocked, 1);
    return Math.max(8, Math.min(100, Math.round((highest / 18) * 100)));
  },

  fillProfileForm() {
    if(!this.state.user) return;
    const user = this.state.user;
    const setValue = (id, value) => {
      const field = document.getElementById(id);
      if(field) field.value = value || '';
    };

    setValue('p_fullname', user.fullName);
    setValue('p_name', user.name);
    setValue('p_password', user.password);
    setValue('p_level', user.knowledgeLevel || user.level || '3');
    setValue('p_age', user.ageGroup || user.age || '');
    setValue('p_gender', user.gender || '');
    setValue('p_location', user.location || '');
    setValue('p_occupation', user.occupation || '');

    const avatarRadio = document.querySelector(`input[name="p_avatar"][value="${user.avatar || 'bertha'}"]`);
    if(avatarRadio) avatarRadio.checked = true;
    this.updateAvatarBio(user.avatar || 'bertha');
  },

  renderProfileDashboard() {
    const dashboard = document.getElementById('profileDashboard');
    if(!dashboard || !this.state.user) return;

    const progress = this.state.user.progress || {};
    const highest = Math.max(...(progress.unlockedPhases || [1]), 1);
    const avatar = this.state.user.avatar || 'bertha';
    const rank = this.getProfileRank(progress);
    const rankFill = this.getAvatarRankFill(progress);
    const summaryAvatar = document.getElementById('profileSummaryAvatar');
    if(summaryAvatar) {
      summaryAvatar.style.setProperty('--avatar-rank-fill', `${rankFill}%`);
      summaryAvatar.innerHTML = `${this.state.avatars[avatar] || ''}<span class="avatar-rank-badge" title="${rank.title}">${rank.icon}</span>`;
    }
    const summaryName = document.getElementById('profileSummaryName');
    if(summaryName) summaryName.innerText = this.state.user.fullName || this.state.user.name;
    const summaryMeta = document.getElementById('profileSummaryMeta');
    if(summaryMeta) summaryMeta.innerText = `Maior ficha liberada: ${highest} • Emblema: ${rank.title}`;

    const badgePanel = document.getElementById('badgePanel');
    if(badgePanel) {
      badgePanel.innerHTML = this.getBadgeCatalog().map((badge, index) => {
        const badgeProgress = this.getBadgeProgress(progress, badge, index);
        return `
        <article class="badge-card ${badgeProgress.state}" style="--badge-fill:${badgeProgress.fill}%">
          <div class="badge-icon"><span>${badge.icon}</span></div>
          <div><strong>${badge.title}</strong><span>${badge.text}</span><div class="badge-meter"><i style="width:${badgeProgress.fill}%"></i></div></div>
        </article>
      `}).join('');
    }
  },

  switchAuthTab(tab) {
    const buttons = ['tabLogin', 'tabRegister', 'tabProfile'];
    buttons.forEach(id => document.getElementById(id)?.classList.remove('active'));
    ['loginForm', 'profileForm', 'profileDashboard'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });

    const title = document.querySelector('#modal-profile .modal-title');
    const desc = document.getElementById('profileFormDesc');
    const heading = document.getElementById('profileFormHeading');
    const submit = document.getElementById('submitProfileBtn');
    const pwd = document.getElementById('pwdContainer');
    const nameField = document.getElementById('p_name');

    if(tab === 'login') {
      document.getElementById('tabLogin')?.classList.add('active');
      const form = document.getElementById('loginForm');
      if(form) form.style.display = 'block';
      if(title) title.innerText = 'Acesso ao Arquivo';
      return;
    }

    if(tab === 'profile' && this.state.user) {
      document.getElementById('tabProfile')?.classList.add('active');
      const dashboard = document.getElementById('profileDashboard');
      if(dashboard) dashboard.style.display = 'block';
      if(title) title.innerText = 'Sua Credencial';
      this.renderProfileDashboard();
      return;
    }

    document.getElementById('tabRegister')?.classList.add('active');
    const form = document.getElementById('profileForm');
    if(form) form.style.display = 'block';
    const editing = tab === 'edit' && !!this.state.user;
    if(title) title.innerText = editing ? 'Editar Credencial' : 'Nova Credencial';
    if(heading) heading.innerText = editing ? 'Ajustes da credencial' : 'Credencial de campo';
    if(desc) desc.innerText = editing ? 'Atualize seus dados sem perder o progresso do dossiê.' : 'Crie sua credencial para entrar no arquivo.';
    if(submit) submit.innerText = editing ? 'Salvar alterações' : 'Criar Credencial';
    if(pwd) pwd.style.display = 'block';
    if(nameField) nameField.readOnly = editing;
    if(editing) this.fillProfileForm();
    else this.updateAvatarBio();
  },

  updateHeaderUI() {
    if(this.state.user) {
      // USA O NOME DE USUÁRIO (exatamente como pedido)
      if(this.playerName) this.playerName.innerText = this.state.user.name;
      if(this.headerAuthBtn) {
        this.headerAuthBtn.style.display = 'inline-block';
        this.headerAuthBtn.innerText = 'Perfil';
        this.headerAuthBtn.title = 'Abrir perfil';
      }
      if(this.logoutBtn) this.logoutBtn.style.display = 'inline-block';
      const tabProfile = document.getElementById('tabProfile');
      if(tabProfile) tabProfile.style.display = 'block';
      if(this.headerAvatar) {
        this.headerAvatar.style.display = 'flex';
        const avatarKey = this.state.user.avatar || 'bertha';
        const rankFill = this.getAvatarRankFill(this.state.user.progress || {});
        this.headerAvatar.classList.add('ranked-avatar');
        this.headerAvatar.style.setProperty('--avatar-rank-fill', `${rankFill}%`);
        this.headerAvatar.innerHTML = this.state.avatars[avatarKey];
      }
      if(this.stampBtn) this.stampBtn.style.display = 'block';
      if(this.stampMark) this.stampMark.classList.remove('stamped');
    } else {
      if(this.playerName) this.playerName.innerText = "Credencial não registrada";
      if(this.headerAuthBtn) {
        this.headerAuthBtn.style.display = 'inline-block';
        this.headerAuthBtn.innerText = 'Entrar / Cadastro';
        this.headerAuthBtn.title = 'Entrar ou criar credencial';
      }
      if(this.logoutBtn) this.logoutBtn.style.display = 'none';
      const tabProfile = document.getElementById('tabProfile');
      if(tabProfile) tabProfile.style.display = 'none';
      if(this.headerAvatar) {
        this.headerAvatar.style.display = 'none';
        this.headerAvatar.classList.remove('ranked-avatar');
        this.headerAvatar.style.removeProperty('--avatar-rank-fill');
        this.headerAvatar.innerHTML = '';
      }
      if(this.stampMark) this.stampMark.classList.remove('stamped');
      if(this.stampBtn) this.stampBtn.style.display = 'block';
    }
  },

  async loadUser() {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      if (data.current) {
        this.state.user = data.current;
        localStorage.setItem('lm_user', JSON.stringify(data.current));
        this.updateHeaderUI();
      }
    } catch (e) { 
      const localUser = JSON.parse(localStorage.getItem('lm_user'));
      if(localUser) {
        this.state.user = localUser;
        this.updateHeaderUI();
      }
    }
  },

  async loginUser(e) {
    e.preventDefault();
    const loginUsername = document.getElementById('l_name').value.trim();
    const loginPassword = document.getElementById('l_password').value.trim();

    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      const foundUser = data.users.find(u => u.name.toLowerCase() === loginUsername.toLowerCase());
      
      if(foundUser) {
        if(foundUser.password === loginPassword) {
          await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(foundUser) });
          this.state.user = foundUser;
          localStorage.setItem('lm_user', JSON.stringify(foundUser));
          this.updateHeaderUI();
          this.closeAllModals();
          this.showToast(`Acesso liberado, ${foundUser.name}!`);
        } else {
          this.showToast("Senha incorreta. Acesso negado.");
        }
      } else {
        this.showToast("Nome de usuário não encontrado.");
      }
    } catch (err) {
      this.showToast("Erro de conexão com o Arquivo Central.");
    }
  },

  async saveProfile(e) {
    e.preventDefault();
    
    const username = document.getElementById('p_name').value.trim();
    const fullname = document.getElementById('p_fullname').value.trim();
    const password = document.getElementById('p_password').value.trim();
    
    try {
      const getRes = await fetch('/api/user');
      const data = await getRes.json();
      const isEditing = this.state.user && this.state.user.name.toLowerCase() === username.toLowerCase();
      if (!isEditing) {
        const exists = data.users.some(u => u.name.toLowerCase() === username.toLowerCase());
        if (exists) {
          this.showToast("Erro: Esse Nome de Usuário já existe. Tente outro.");
          return;
        }
      }
    } catch (err) {}

    const selectedAvatar = document.querySelector('input[name="p_avatar"]:checked');
    const payload = {
      name: username,
      fullName: fullname,
      password: password,
      knowledgeLevel: document.getElementById('p_level').value,
      ageGroup: document.getElementById('p_age').value,
      gender: document.getElementById('p_gender').value,
      location: document.getElementById('p_location').value,
      occupation: document.getElementById('p_occupation').value,
      avatar: selectedAvatar ? selectedAvatar.value : 'bertha'
    };

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      this.state.user = data.current;
      localStorage.setItem('lm_user', JSON.stringify(data.current));
      
      this.updateHeaderUI();
      this.closeAllModals();
      this.showToast("Credencial salva com sucesso!");
    } catch (e) {
      this.state.user = payload;
      localStorage.setItem('lm_user', JSON.stringify(payload));
      this.updateHeaderUI();
      this.closeAllModals();
      this.showToast("Credencial salva localmente (Offline).");
    }
  },

  async logout() {
    try { await fetch('/api/user/logout', { method: 'POST' }); } catch (e) {}
    this.state.user = null;
    localStorage.removeItem('lm_user');
    if(document.getElementById('profileForm')) document.getElementById('profileForm').reset();
    if(document.getElementById('loginForm')) document.getElementById('loginForm').reset();
    this.updateHeaderUI();
    this.showToast("Credencial devolvida. Acesso revogado.");
  },

  applyStamp(dateObj = new Date()) {
    if(this.stampBtn) this.stampBtn.style.display = 'none';
    if(document.getElementById('stampDate')) document.getElementById('stampDate').innerText = dateObj.toLocaleDateString('pt-BR');
    if(this.stampMark) this.stampMark.classList.add('stamped');
  },

  async saveReview(e) {
    e.preventDefault();
    if(!this.state.user) return this.showToast("Você precisa criar um Perfil primeiro.");
    if(this.state.rating === 0) return this.showToast("Atribua uma nota nas estrelas.");
    const review = { name: this.state.user.name, rating: this.state.rating, mechanics: document.getElementById('r_mechanics').value, immersion: document.getElementById('r_immersion').value, improvements: document.getElementById('r_improvements').value, date: new Date().toISOString() };
    try {
      await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) });
      this.closeAllModals();
      this.showToast("Relatório arquivado. Obrigado!");
    } catch (e) {
      this.showToast("Erro ao arquivar relatório.");
    }
  },

  openModal(id) {
    if(this.fullMenu) this.fullMenu.classList.remove('active'); 
    if(this.modalOverlay) this.modalOverlay.classList.add('active');
    if(this.modals) this.modals.forEach(m => m.classList.remove('active'));
    
    if(id === 'review') {
      const rl = document.getElementById('reviewLocked');
      const ru = document.getElementById('reviewUnlocked');
      if(rl) rl.style.display = this.state.isGameCompleted ? 'none' : 'block';
      if(ru) ru.style.display = this.state.isGameCompleted ? 'block' : 'none';
    }

    if(id === 'profile') {
      const tabLogin = document.getElementById('tabLogin');
      const tabRegister = document.getElementById('tabRegister');
      if (this.state.user && tabRegister) tabRegister.click();
      else if (tabLogin) tabLogin.click();
    }

    const modal = document.getElementById(`modal-${id}`);
    if(modal) {
      modal.classList.add('active');
      setTimeout(() => {
        const firstInput = modal.querySelector('input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if(firstInput) firstInput.focus();
      }, 100);
    }
  },

  closeAllModals() {
    if(this.modalOverlay) this.modalOverlay.classList.remove('active');
    if(this.modals) this.modals.forEach(m => m.classList.remove('active'));
  },

  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  loadUser() {
    this.state.user = LMProfileStore.getCurrentUser();
    this.updateHeaderUI();
  },

  loginUser(e) {
    e.preventDefault();
    const loginUsername = document.getElementById('l_name').value.trim();
    const loginPassword = document.getElementById('l_password').value.trim();

    try {
      const foundUser = LMProfileStore.login(loginUsername, loginPassword);
      this.state.user = foundUser;
      this.updateHeaderUI();
      this.closeAllModals();
      this.showToast(`Acesso liberado, ${foundUser.name}!`);
    } catch (err) {
      this.showToast(err.message === 'bad-password' ? "Senha incorreta. Acesso negado." : "Nome de usuario nao encontrado.");
    }
  },

  saveProfile(e) {
    e.preventDefault();

    const selectedAvatar = document.querySelector('input[name="p_avatar"]:checked');
    const payload = {
      name: document.getElementById('p_name').value.trim(),
      fullName: document.getElementById('p_fullname').value.trim(),
      password: document.getElementById('p_password').value.trim(),
      knowledgeLevel: document.getElementById('p_level').value,
      ageGroup: document.getElementById('p_age').value,
      gender: document.getElementById('p_gender').value,
      location: document.getElementById('p_location').value,
      occupation: document.getElementById('p_occupation').value,
      avatar: selectedAvatar ? selectedAvatar.value : 'bertha'
    };

    try {
      this.state.user = this.state.user ? LMProfileStore.updateCurrentUser(payload) : LMProfileStore.register(payload);
      this.updateHeaderUI();
      this.renderProfileDashboard();
      this.closeAllModals();
      this.showToast("Credencial salva com sucesso!");
    } catch (err) {
      this.showToast(err.message === 'duplicate-user' ? "Erro: Esse Nome de Usuario ja existe. Tente outro." : "Preencha a credencial antes de continuar.");
    }
  },

  logout() {
    LMProfileStore.clearCurrentUser();
    this.state.user = null;
    if(document.getElementById('profileForm')) document.getElementById('profileForm').reset();
    if(document.getElementById('loginForm')) document.getElementById('loginForm').reset();
    this.updateHeaderUI();
    this.showToast("Credencial devolvida. Acesso revogado.");
  },

  showProfileDecision({ title, message, confirmText, variant = '', onConfirm }) {
    document.querySelector('.profile-decision-layer')?.remove();
    const layer = document.createElement('div');
    layer.className = 'profile-decision-layer';
    layer.innerHTML = `
      <div class="profile-decision-card" role="dialog" aria-modal="true" aria-labelledby="profileDecisionTitle">
        <button type="button" class="profile-decision-close" aria-label="Fechar">×</button>
        <span class="profile-decision-kicker">Confirmação do arquivo</span>
        <h3 id="profileDecisionTitle">${title}</h3>
        <p>${message}</p>
        <div class="profile-decision-actions">
          <button type="button" class="btn-secondary profile-decision-cancel">Voltar</button>
          <button type="button" class="btn-secondary ${variant} profile-decision-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(layer);

    const close = () => layer.remove();
    layer.querySelector('.profile-decision-close')?.addEventListener('click', close);
    layer.querySelector('.profile-decision-cancel')?.addEventListener('click', close);
    layer.addEventListener('click', (e) => { if(e.target === layer) close(); });
    layer.querySelector('.profile-decision-confirm')?.addEventListener('click', () => {
      close();
      if(typeof onConfirm === 'function') onConfirm();
    });
  },

  resetProgress() {
    if(!this.state.user) return this.showToast("Entre na sua credencial primeiro.");
    this.showProfileDecision({
      title: 'Restaurar progresso?',
      message: 'Essa ação apaga fases liberadas, respostas, inventário e emblemas desta conta. A credencial continua existindo, mas o arquivo volta ao começo.',
      confirmText: 'Restaurar mesmo',
      variant: 'danger-soft',
      onConfirm: () => {
        this.state.user = LMProfileStore.resetCurrentProgress();
        this.updateHeaderUI();
        this.renderProfileDashboard();
        this.showToast("Progresso restaurado. O arquivo voltou ao início.");
      }
    });
  },

  deleteAccount() {
    if(!this.state.user) return this.showToast("Nenhuma conta ativa para excluir.");
    this.showProfileDecision({
      title: 'Excluir conta?',
      message: 'Essa ação apaga a credencial e todo o progresso salvo. Não dá para desfazer depois.',
      confirmText: 'Excluir conta',
      variant: 'danger-strong',
      onConfirm: () => {
        LMProfileStore.deleteCurrentUser();
        this.state.user = null;
        document.getElementById('profileForm')?.reset();
        document.getElementById('loginForm')?.reset();
        this.updateHeaderUI();
        this.closeAllModals();
        this.showToast("Conta excluída do arquivo.");
      }
    });
  },

  saveReview(e) {
    e.preventDefault();
    if(!this.state.user) return this.showToast("Voce precisa criar um Perfil primeiro.");
    if(this.state.rating === 0) return this.showToast("Atribua uma nota nas estrelas.");

    const review = {
      name: this.state.user.name,
      rating: this.state.rating,
      mechanics: document.getElementById('r_mechanics').value,
      immersion: document.getElementById('r_immersion').value,
      improvements: document.getElementById('r_improvements').value,
      date: new Date().toISOString()
    };

    try {
      this.state.user = LMProfileStore.saveReview(review);
      this.closeAllModals();
      this.showToast("Relatorio arquivado. Obrigado!");
    } catch (err) {
      this.showToast("Erro ao arquivar relatorio.");
    }
  },

  openModal(id) {
    if(this.fullMenu) this.fullMenu.classList.remove('active');
    if(this.modalOverlay) this.modalOverlay.classList.add('active');
    if(this.modals) this.modals.forEach(m => m.classList.remove('active'));

    if(id === 'review') {
      const rl = document.getElementById('reviewLocked');
      const ru = document.getElementById('reviewUnlocked');
      const canReview = this.state.isGameCompleted || !!(this.state.user && this.state.user.progress && this.state.user.progress.unlockedPhases.includes(6));
      if(rl) rl.style.display = canReview ? 'none' : 'block';
      if(ru) ru.style.display = canReview ? 'block' : 'none';
    }

    if(id === 'profile') {
      this.switchAuthTab(this.state.user ? 'profile' : 'login');
    }

    const modal = document.getElementById(`modal-${id}`);
    if(modal) {
      modal.classList.add('active');
      setTimeout(() => {
        const firstInput = modal.querySelector('input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if(firstInput) firstInput.focus();
      }, 100);
    }
  },

  setup3D() {
    if(!this.dossier) return;
    document.addEventListener('mousemove', (e) => {
      if(window.innerWidth < 900) return; 
      const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
      this.dossier.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });
    document.addEventListener('mouseleave', () => {
      this.dossier.style.transform = `rotateY(0deg) rotateX(0deg)`;
    });
  },

  renderStars() {
    this.ratingControl = LMRating.init('starRating', {
      initialValue: this.state.user && this.state.user.progress && this.state.user.progress.finalReview ? this.state.user.progress.finalReview.rating : 0,
      onChange: (value) => { this.state.rating = value; }
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('game-body')) Game.init();
});
