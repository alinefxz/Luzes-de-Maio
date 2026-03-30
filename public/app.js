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
    this.menuBtn.addEventListener('click', () => this.fullMenu.classList.add('active'));
    this.closeMenuBtn.addEventListener('click', () => this.fullMenu.classList.remove('active'));

    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    this.modalOverlay.addEventListener('click', (e) => {
      if(e.target === this.modalOverlay) this.closeAllModals();
    });

    document.getElementById('profileForm').addEventListener('submit', (e) => this.saveProfile(e));
    document.getElementById('reviewForm').addEventListener('submit', (e) => this.saveReview(e));
    
    this.logoutBtn.addEventListener('click', () => this.logout());

    this.stampBtn.addEventListener('click', () => {
      if(!this.state.user) {
        this.showToast("Crie sua credencial primeiro!");
        this.openModal('profile');
        return;
      }
      this.applyStamp();
    });

    document.getElementById('testCompleteBtn').addEventListener('click', () => {
      this.state.isGameCompleted = !this.state.isGameCompleted;
      const btn = document.getElementById('testCompleteBtn');
      btn.innerText = this.state.isGameCompleted ? "Modo Teste: Reverter" : "Modo Teste: Concluir";
      btn.style.backgroundColor = this.state.isGameCompleted ? "var(--sage)" : "";
      btn.style.color = this.state.isGameCompleted ? "var(--charcoal)" : "";
      this.showToast(this.state.isGameCompleted ? "Jogo marcado como CONCLUÍDO." : "Jogo marcado como PENDENTE.");
    });
    
    document.getElementById('startBtn').addEventListener('click', () => {
      if(!this.state.user) {
        this.showToast("Acesso Restrito: Identifique-se no Arquivo primeiro.");
        this.openModal('profile');
        return;
      }
      this.showToast("Iniciando carregamento do motor do jogo...");
    });

    // ATALHO ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        this.fullMenu.classList.remove('active');
      }
    });
  },

  updateHeaderUI() {
    if(this.state.user) {
      this.playerName.innerText = this.state.user.name;
      this.logoutBtn.style.display = 'inline-block';
      this.headerAvatar.style.display = 'flex';
      
      const avatarKey = this.state.user.avatar || 'bertha';
      this.headerAvatar.innerHTML = this.state.avatars[avatarKey];
      
      this.stampBtn.style.display = 'block';
      this.stampMark.classList.remove('stamped');
    } else {
      this.playerName.innerText = "Não Identificado";
      this.logoutBtn.style.display = 'none';
      this.headerAvatar.style.display = 'none';
      this.headerAvatar.innerHTML = '';
      this.stampMark.classList.remove('stamped');
      this.stampBtn.style.display = 'block';
    }
  },

  async loadUser() {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      if (data.current) {
        this.state.user = data.current;
        this.updateHeaderUI();

        document.getElementById('p_name').value = this.state.user.name || '';
        document.getElementById('p_level').value = this.state.user.knowledgeLevel || '3';
        if(this.state.user.ageGroup) document.getElementById('p_age').value = this.state.user.ageGroup;
        if(this.state.user.gender) document.getElementById('p_gender').value = this.state.user.gender;
        if(this.state.user.location) document.getElementById('p_location').value = this.state.user.location;
        if(this.state.user.occupation) document.getElementById('p_occupation').value = this.state.user.occupation;
        
        const avatarRadio = document.querySelector(`input[name="p_avatar"][value="${this.state.user.avatar}"]`);
        if(avatarRadio) avatarRadio.checked = true;
      }
    } catch (e) { console.log("Rodando sem servidor backend."); }
  },

  async saveProfile(e) {
    e.preventDefault();
    
    const selectedAvatar = document.querySelector('input[name="p_avatar"]:checked');
    const payload = {
      name: document.getElementById('p_name').value.trim(),
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
      this.updateHeaderUI();
      this.closeAllModals();
      this.showToast("Credencial salva. Você já pode carimbar o dossiê.");
    } catch (e) {
      this.showToast("Erro ao contatar o arquivo central.");
    }
  },

  async logout() {
    try {
      await fetch('/api/user/logout', { method: 'POST' });
      this.state.user = null;
      
      document.getElementById('p_name').value = '';
      document.querySelector(`input[name="p_avatar"][value="bertha"]`).checked = true;
      
      this.updateHeaderUI();
      this.showToast("Sessão encerrada. Arquivo devolvido.");
    } catch (e) {
      console.error("Erro ao deslogar.");
    }
  },

  applyStamp(dateObj = new Date()) {
    this.stampBtn.style.display = 'none';
    document.getElementById('stampDate').innerText = dateObj.toLocaleDateString('pt-BR');
    this.stampMark.classList.add('stamped');
  },

  async saveReview(e) {
    e.preventDefault();
    if(!this.state.user) return this.showToast("Você precisa criar um Perfil primeiro.");
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
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review)
      });
      this.closeAllModals();
      this.showToast("Relatório arquivado. Obrigado!");
    } catch (e) {
      this.showToast("Erro ao arquivar relatório.");
    }
  },

  openModal(id) {
    this.fullMenu.classList.remove('active'); 
    this.modalOverlay.classList.add('active');
    this.modals.forEach(m => m.classList.remove('active'));
    
    if(id === 'review') {
      document.getElementById('reviewLocked').style.display = this.state.isGameCompleted ? 'none' : 'block';
      document.getElementById('reviewUnlocked').style.display = this.state.isGameCompleted ? 'block' : 'none';
    }

    const modal = document.getElementById(`modal-${id}`);
    modal.classList.add('active');

    setTimeout(() => {
      const firstInput = modal.querySelector('input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(firstInput) firstInput.focus();
    }, 100);
  },

  closeAllModals() {
    this.modalOverlay.classList.remove('active');
    this.modals.forEach(m => m.classList.remove('active'));
  },

  showToast(msg) {
    const container = document.getElementById('toastContainer');
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

  renderStars() {
    const container = document.getElementById('starRating');
    if(!container) return;
    container.innerHTML = '';
    const svgPath = "M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z";

    for(let i=1; i<=5; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.classList.add('star-svg');
      svg.dataset.val = i;
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute('d', svgPath);
      svg.appendChild(path);
      
      svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const isHalf = (e.clientX - rect.left) < (rect.width / 2);
        const hoverVal = i - (isHalf ? 0.5 : 0);
        this.updateStarUI(hoverVal);
        document.getElementById('starValue').innerText = `Nota: ${hoverVal.toFixed(1).replace('.', ',')} / 5`;
      });

      svg.addEventListener('mouseleave', () => {
        this.updateStarUI(this.state.rating);
        document.getElementById('starValue').innerText = `Nota: ${this.state.rating.toFixed(1).replace('.', ',')} / 5`;
      });

      svg.addEventListener('click', (e) => {
        const rect = svg.getBoundingClientRect();
        const isHalf = (e.clientX - rect.left) < (rect.width / 2);
        this.state.rating = i - (isHalf ? 0.5 : 0);
        this.updateStarUI(this.state.rating);
        document.getElementById('starValue').innerText = `Nota: ${this.state.rating.toFixed(1).replace('.', ',')} / 5`;
        container.setAttribute('aria-valuenow', this.state.rating);
      });

      container.appendChild(svg);
    }

    container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.state.rating = Math.min(5, this.state.rating + 0.5);
        this.updateStarUI(this.state.rating);
        document.getElementById('starValue').innerText = `Nota: ${this.state.rating.toFixed(1).replace('.', ',')} / 5`;
        container.setAttribute('aria-valuenow', this.state.rating);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.state.rating = Math.max(0.5, this.state.rating - 0.5);
        this.updateStarUI(this.state.rating);
        document.getElementById('starValue').innerText = `Nota: ${this.state.rating.toFixed(1).replace('.', ',')} / 5`;
        container.setAttribute('aria-valuenow', this.state.rating);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        container.style.opacity = '0.5';
        setTimeout(() => container.style.opacity = '1', 100);
      }
    });
  },

  updateStarUI(hoverVal) {
    const stars = document.querySelectorAll('.star-svg');
    stars.forEach((star, index) => {
      const starVal = index + 1;
      star.classList.remove('filled', 'half-filled');
      if (hoverVal >= starVal) {
        star.classList.add('filled');
      } else if (hoverVal === starVal - 0.5) {
        star.classList.add('half-filled');
      }
    });
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());