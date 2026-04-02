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
    const loginForm = document.getElementById('loginForm');
    const profileForm = document.getElementById('profileForm');

    if(tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
        loginForm.style.display = 'block'; profileForm.style.display = 'none';
      });
      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active'); tabLogin.classList.remove('active');
        profileForm.style.display = 'block'; loginForm.style.display = 'none';
        
        if(this.state.user) {
          document.getElementById('p_fullname').value = this.state.user.fullName || '';
          document.getElementById('p_name').value = this.state.user.name || '';
          document.getElementById('p_password').value = this.state.user.password || '';
          document.getElementById('p_level').value = this.state.user.knowledgeLevel || '3';
          if(this.state.user.ageGroup) document.getElementById('p_age').value = this.state.user.ageGroup;
          if(this.state.user.gender) document.getElementById('p_gender').value = this.state.user.gender;
          if(this.state.user.location) document.getElementById('p_location').value = this.state.user.location;
          if(this.state.user.occupation) document.getElementById('p_occupation').value = this.state.user.occupation;
          
          const avatarRadio = document.querySelector(`input[name="p_avatar"][value="${this.state.user.avatar}"]`);
          if(avatarRadio) avatarRadio.checked = true;
        }
      });
    }

    // Teclado Avatares
    document.querySelectorAll('.avatar-option').forEach(label => {
      label.addEventListener('keydown', (e) => {
        if(e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const radio = label.querySelector('input[type="radio"]');
          if(radio) radio.checked = true;
        }
      });
    });

    if(profileForm) profileForm.addEventListener('submit', (e) => this.saveProfile(e));
    if(loginForm) loginForm.addEventListener('submit', (e) => this.loginUser(e));
    
    const reviewForm = document.getElementById('reviewForm');
    if(reviewForm) reviewForm.addEventListener('submit', (e) => this.saveReview(e));
    
    if(this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.logout());

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
        
        const localUser = JSON.parse(localStorage.getItem('lm_user'));
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
      if (e.key === 'Escape') {
        this.closeAllModals();
        if(this.fullMenu) this.fullMenu.classList.remove('active');
      }
    });
  },

  updateHeaderUI() {
    if(this.state.user) {
      // USA O NOME DE USUÁRIO (exatamente como pedido)
      if(this.playerName) this.playerName.innerText = this.state.user.name;
      if(this.logoutBtn) this.logoutBtn.style.display = 'inline-block';
      if(this.headerAvatar) {
        this.headerAvatar.style.display = 'flex';
        const avatarKey = this.state.user.avatar || 'bertha';
        this.headerAvatar.innerHTML = this.state.avatars[avatarKey];
      }
      if(this.stampBtn) this.stampBtn.style.display = 'block';
      if(this.stampMark) this.stampMark.classList.remove('stamped');
    } else {
      if(this.playerName) this.playerName.innerText = "Não Identificado";
      if(this.logoutBtn) this.logoutBtn.style.display = 'none';
      if(this.headerAvatar) {
        this.headerAvatar.style.display = 'none';
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

  renderStars() { /* ... Lógica das estrelas continua intacta ... */ }
};

window.addEventListener('DOMContentLoaded', () => Game.init());