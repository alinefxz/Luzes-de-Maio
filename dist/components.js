const UIComponents = {
  renderHeader() {
    const oldHeader = document.querySelector('header');
    if (oldHeader) oldHeader.remove();

    const isGame = window.location.pathname.includes('game');
    
    const headerHTML = `
      <header class="glass-header ${isGame ? 'game-header-slim' : ''}" style="position: relative; z-index: 9999;">
        <div class="logo-area">
          ${isGame 
            ? `<a href="index.html" class="btn-return-home" id="btnReturnIndex" title="Voltar ao início">← Abandonar</a>` 
            : `<img src="assets/logo.png" alt="Logo" class="main-logo" onerror="this.src='data:image/svg+xml;utf8,<svg viewBox=\\'0 0 50 50\\' xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'50\\' height=\\'50\\' fill=\\'%2393585E\\'/></svg>';">`
          }
          <div class="header-titles" style="${isGame ? 'margin-left: 15px;' : ''}">
            <span class="header-kicker">${isGame ? 'Arquivo Central' : 'Muzambinho, MG'}</span>
            <span class="header-title">${isGame ? 'Mesa de Investigação' : 'Luzes de Maio'}</span>
          </div>
        </div>
        
        <div class="nav-controls">
          <div class="user-badge" id="userBadge">
            <div class="avatar-display" id="headerAvatar" style="display: none;"></div>
            <div class="badge-texts">
              <span class="badge-label">Credencial</span>
              <span class="badge-name typewriter" id="playerName">Não Identificado</span>
            </div>
          </div>
          <button class="menu-btn" id="menuBtn" aria-label="Abrir Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    this.updateUserUI();
  },

  renderFooter() {
    const oldFooter = document.querySelector('footer');
    if (oldFooter) oldFooter.remove();

    const footerHTML = `
      <footer class="site-footer">
        <div class="section-container footer-content">
          <div class="footer-col brand-col">
            <div class="footer-logo-wrap">
              <h2 style="font-family: var(--font-serif); color: var(--blush); font-size: 2rem;">Luzes de Maio</h2>
            </div>
            <p class="typewriter footer-desc">Preservar a memória é o primeiro passo para garantir o futuro.</p>
          </div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 Luzes de Maio.</p></div>
      </footer>
    `;
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  },

  updateUserUI() {
    const user = JSON.parse(localStorage.getItem('lm_user'));
    if (user) {
      const playerNameEl = document.getElementById('playerName');
      const avatarEl = document.getElementById('headerAvatar');
      if (playerNameEl) playerNameEl.innerText = user.name;
      if (avatarEl) {
        avatarEl.style.display = 'flex';
        avatarEl.innerHTML = `<img src="assets/${user.avatar}.png" onerror="this.src='data:image/svg+xml;utf8,<svg viewBox=\\'0 0 100 100\\' xmlns=\\'http://www.w3.org/2000/svg\\'><circle cx=\\'50\\' cy=\\'50\\' r=\\'50\\' fill=\\'%23F2CFCD\\'/></svg>';">`;
      }
    }
  },

  startTimeTravel(destinationUrl) {
    const overlay = document.createElement('div');
    overlay.id = 'timeTravelOverlay';
    overlay.innerHTML = `<div class="time-tunnel"></div><div class="year-counter" id="yearCounter">2026</div>`;
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.classList.add('active');
      const counterEl = document.getElementById('yearCounter');
      let startYear = 2026, endYear = 1930, duration = 3000, startTime = null;

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        counterEl.innerText = Math.floor(startYear - ((startYear - endYear) * easeOut));

        if(progress > 0.3 && progress < 0.9) {
          counterEl.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px) scale(1.2)`;
        } else {
          counterEl.style.transform = `scale(1.5)`;
        }

        if (progress < 1) window.requestAnimationFrame(step);
        else {
          counterEl.innerText = endYear;
          overlay.classList.add('blackout');
          setTimeout(() => window.location.href = destinationUrl, 800);
        }
      };
      window.requestAnimationFrame(step);
    }, 50);
  }
};

UIComponents.renderHeader();
UIComponents.renderFooter();

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  if(startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const localUser = JSON.parse(localStorage.getItem('lm_user'));
      const gameUser = (typeof Game !== 'undefined' && Game.state) ? Game.state.user : null;
      
      if(!localUser && !gameUser) {
        if(typeof Game !== 'undefined') { Game.showToast("Crie sua credencial antes de iniciar."); Game.openModal('profile'); }
        return;
      }
      UIComponents.startTimeTravel('game.html');
    });
  }
});