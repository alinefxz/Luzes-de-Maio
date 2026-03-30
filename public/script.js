const Game = {
  state: {
    // Busca dados no cache para não perder ao trocar de tela
    user: JSON.parse(localStorage.getItem('lm_user')) || null,
    jogoFinalizado: localStorage.getItem('lm_finished') === 'true',
    avatars: {
      'bertha': '<img src="assets/bertha.png" alt="Bertha Lutz">',
      'celina': '<img src="assets/celina.png" alt="Celina Guimarães">',
      'leolinda': '<img src="assets/leolinda.png" alt="Leolinda Daltro">',
      'mietta': '<img src="assets/mietta.png" alt="Mietta Santiago">'
    }
  },

  init() {
    this.updateHeaderUI();
    this.bindGlobalEvents();
    
    // Identifica em qual página estamos
    if (document.getElementById('startBtn')) {
      this.initLandingPage();
    } else if (document.getElementById('gameContainer')) {
      this.initGamePage();
    }
  },

  /* ========================================================= */
  /* EVENTOS GLOBAIS E DE HEADER                               */
  /* ========================================================= */
  bindGlobalEvents() {
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const fullMenu = document.getElementById('fullMenu');
    
    if(menuBtn) menuBtn.addEventListener('click', () => fullMenu.classList.add('active'));
    if(closeMenuBtn) closeMenuBtn.addEventListener('click', () => fullMenu.classList.remove('active'));

    // Corrigido: Evento de Fechar Modais (Clicar no X e no Fundo)
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeAllModals();
      });
    });

    const overlay = document.getElementById('modalOverlay');
    if(overlay) {
      overlay.addEventListener('click', (e) => {
        if(e.target === overlay) this.closeAllModals();
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    // Formulário de Cadastro (Modal Profile)
    const profileForm = document.getElementById('profileForm');
    if(profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedAvatar = document.querySelector('input[name="p_avatar"]:checked');
        const userData = {
          name: document.getElementById('p_name').value.trim(),
          avatar: selectedAvatar ? selectedAvatar.value : 'bertha'
        };
        
        // Salva localmente
        this.state.user = userData;
        localStorage.setItem('lm_user', JSON.stringify(userData));
        
        this.updateHeaderUI();
        this.closeAllModals();
        this.showToast("Credencial criada! Bem-vindo(a) ao Arquivo.");
      });
    }
  },

  updateHeaderUI() {
    const playerName = document.getElementById('playerName');
    const logoutBtn = document.getElementById('logoutBtn');
    const headerAvatar = document.getElementById('headerAvatar');

    if(this.state.user) {
      if(playerName) playerName.innerText = this.state.user.name;
      if(logoutBtn) logoutBtn.style.display = 'inline-block';
      if(headerAvatar) {
        headerAvatar.style.display = 'flex';
        const avatarKey = this.state.user.avatar || 'bertha';
        headerAvatar.innerHTML = this.state.avatars[avatarKey] || '';
      }
    } else {
      if(playerName) playerName.innerText = "Não Identificado";
      if(logoutBtn) logoutBtn.style.display = 'none';
      if(headerAvatar) {
        headerAvatar.style.display = 'none';
        headerAvatar.innerHTML = '';
      }
    }
  },

  logout() {
    this.state.user = null;
    localStorage.removeItem('lm_user');
    this.updateHeaderUI();
    this.showToast("Credencial devolvida.");
  },

  /* ========================================================= */
  /* FUNCIONALIDADES DA INDEX.HTML                             */
  /* ========================================================= */
  initLandingPage() {
    // 1. Botão de Carimbo Corrigido
    const stampBtn = document.getElementById('stampBtn');
    const stampMark = document.getElementById('stampMark');
    
    if (stampBtn) {
      stampBtn.addEventListener('click', () => {
        if (!this.state.user) {
          this.showToast("Crie sua credencial primeiro!");
          this.openModal('profile');
        } else {
          stampBtn.style.display = 'none';
          document.getElementById('stampDate').innerText = new Date().toLocaleDateString('pt-BR');
          stampMark.classList.add('stamped');
          this.showToast("Documento carimbado com sucesso.");
        }
      });
    }

    // 2. Botão Modo Teste Corrigido
    const testBtn = document.getElementById('testCompleteBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.state.jogoFinalizado = true;
        localStorage.setItem('lm_finished', 'true');
        testBtn.style.backgroundColor = "var(--sage)";
        testBtn.style.color = "var(--charcoal)";
        testBtn.innerText = "Modo Teste Ativo";
        this.showToast("Jogo marcado como CONCLUÍDO. Avaliação desbloqueada.");
      });
    }

    // 3. Botão Iniciar e Animação de Viagem no Tempo
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.state.user) {
          this.showToast("Acesso Restrito: Identifique-se no Arquivo primeiro.");
          this.openModal('profile');
          return;
        }
        this.startTimeTravel();
      });
    }
  },

  startTimeTravel() {
    const overlay = document.getElementById('timeTravelOverlay');
    const counterEl = document.getElementById('yearCounter');
    if (!overlay || !counterEl) return;

    overlay.classList.add('active');
    
    const startYear = 2026;
    const endYear = 1930;
    const duration = 2500;
    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentYear = Math.floor(startYear - ((startYear - endYear) * easeOutQuart));
      
      counterEl.innerText = currentYear;

      if(progress > 0.3 && progress < 0.9) {
        counterEl.style.transform = `translate(${Math.random()*6-3}px, ${Math.random()*6-3}px) scale(1.2)`;
      } else {
        counterEl.style.transform = `translate(0, 0) scale(1.5)`;
      }

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        counterEl.innerText = endYear;
        overlay.classList.add('blackout');
        setTimeout(() => {
          window.location.href = 'game.html';
        }, 800);
      }
    };
    window.requestAnimationFrame(step);
  },

  /* ========================================================= */
  /* GESTÃO DE MODAIS E UX                                     */
  /* ========================================================= */
  openModal(id) {
    const fullMenu = document.getElementById('fullMenu');
    if(fullMenu) fullMenu.classList.remove('active'); 

    this.closeAllModals();

    // Lógica de Bloqueio do Modal de Review
    if(id === 'review') {
      const locked = document.getElementById('reviewLocked');
      const unlocked = document.getElementById('reviewUnlocked');
      
      if(this.state.jogoFinalizado) {
        if(locked) locked.style.display = 'none';
        if(unlocked) unlocked.style.display = 'block';
      } else {
        if(locked) locked.style.display = 'block';
        if(unlocked) unlocked.style.display = 'none';
      }
    }

    const modal = document.getElementById(`modal-${id}`);
    if(modal) modal.classList.add('active');
    
    const overlay = document.getElementById('modalOverlay');
    if(overlay) overlay.classList.add('active');
  },

  closeAllModals() {
    const overlay = document.getElementById('modalOverlay');
    if(overlay) overlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
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

  /* ========================================================= */
  /* FUNCIONALIDADES DO GAME.HTML (MAPA E VISUAL NOVEL)        */
  /* ========================================================= */
  initGamePage() {
    this.vnOverlay = document.getElementById('npcOverlay');
    this.vnText = document.getElementById('npcDialogueText');
    this.vnHint = document.getElementById('npcHint');
    this.vnBtn = document.getElementById('npcActionBtn');
    this.gameContainer = document.getElementById('gameContainer');

    this.scriptFase1 = [
      "Investigador(a) " + (this.state.user ? this.state.user.name : "") + ", sou uma voz esquecida pelo tempo. Preciso da sua ajuda.",
      "Para entender como conquistamos o direito de votar em Muzambinho, você deve analisar a luta no Brasil inteiro primeiro.",
      "Inicie sua busca analisando os arquivos do Movimento Nacional. Clique no alfinete iluminado no mapa."
    ];

    // Clique na overlay para avançar texto
    this.vnOverlay.addEventListener('click', (e) => {
      if (e.target === this.vnBtn) return; 
      this.advanceDialogue();
    });

    // Botão final do diálogo
    this.vnBtn.addEventListener('click', () => {
      this.vnOverlay.style.opacity = '0';
      this.gameContainer.classList.remove('blurred');
      setTimeout(() => {
        this.vnOverlay.classList.remove('active');
        this.isDialogueActive = false;
      }, 500);
    });

    // Inicia a novela visual após leve atraso
    setTimeout(() => {
      this.startDialogue(this.scriptFase1, 'start');
    }, 500);

    // Faz os botões bloqueados gerarem a fala do NPC
    document.querySelectorAll('.locked-pin').forEach(pin => {
      pin.addEventListener('click', (e) => {
        const local = e.currentTarget.parentElement.querySelector('.pin-label').innerText;
        this.checkLocked(local);
      });
    });

    // Fase 1 Click
    document.getElementById('pinFase1').addEventListener('click', () => {
      this.showToast("Iniciando Fase 1: Âmbito Nacional...");
      // Lógica de entrar na fase virá no próximo passo
    });
  },

  startDialogue(linesArray, type) {
    this.currentDialogueLines = linesArray;
    this.currentLineIndex = 0;
    this.isDialogueActive = true;
    this.dialogueType = type;

    this.vnHint.style.display = 'block';
    this.vnBtn.style.display = 'none';
    this.vnText.innerText = this.currentDialogueLines[this.currentLineIndex];
    
    this.vnOverlay.classList.add('active');
    this.vnOverlay.style.opacity = '1';
    this.gameContainer.classList.add('blurred');
  },

  advanceDialogue() {
    if (!this.isDialogueActive) return;

    this.currentLineIndex++;
    if (this.currentLineIndex < this.currentDialogueLines.length) {
      this.vnText.innerText = this.currentDialogueLines[this.currentLineIndex];
    } else {
      this.vnHint.style.display = 'none';
      this.vnBtn.style.display = 'inline-flex';
      this.vnBtn.innerText = this.dialogueType === 'start' ? "Assumir a Mesa →" : "Entendido";
    }
  },

  checkLocked(localName) {
    const lockedScript = [
      `Atenção. Os documentos sobre a "${localName}" ainda estão sob sigilo no Arquivo.`,
      `Você precisa solucionar a etapa atual antes de avançar. Foco na investigação aberta.`
    ];
    this.startDialogue(lockedScript, 'locked');
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());