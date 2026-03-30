const AppComponents = {
    // 1. Injetor de Header Dinâmico
    renderHeader() {
        // Verifica se é a página do jogo para trocar o botão de saída
        const isGame = window.location.pathname.includes('game.html');
        
        const headerHTML = `
            <header class="glass-header">
                <div class="logo-area">
                    <img src="assets/logo.png" alt="Logo Luzes de Maio" class="main-logo" onerror="this.src='data:image/svg+xml;utf8,<svg viewBox=\\'0 0 50 50\\' xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'50\\' height=\\'50\\' fill=\\'%2393585E\\'/></svg>';">
                    <div class="header-titles">
                        <span class="header-kicker">Muzambinho, MG</span>
                        <span class="header-title">Luzes de Maio</span>
                    </div>
                </div>
                
                <div class="nav-controls">
                    ${isGame ? `
                        <a href="index.html" class="btn-return-home" title="Voltar ao Início">
                            <span>Sair da Investigação ✕</span>
                        </a>
                    ` : `
                        <div class="user-badge" id="userBadge">
                            <div class="avatar-display" id="headerAvatar" style="display: none;"></div>
                            <div class="badge-texts">
                                <span class="badge-label">Credencial</span>
                                <span class="badge-name typewriter" id="playerName">Investigador(a)</span>
                            </div>
                        </div>
                    `}
                </div>
            </header>
        `;

        // Insere o header logo após a abertura do <body>
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    },

    // 2. Animação de Viagem no Tempo (2026 -> 1930)
    startTimeTravel(destinationUrl) {
        // Cria o Overlay
        const overlay = document.createElement('div');
        overlay.id = 'timeTravelOverlay';
        overlay.innerHTML = `
            <div class="time-tunnel"></div>
            <div class="year-counter" id="yearCounter">2026</div>
        `;
        document.body.appendChild(overlay);

        // Força o reflow para iniciar a animação CSS
        setTimeout(() => {
            overlay.classList.add('active');
            this.animateCounter(2026, 1930, 2500, () => {
                // Ao terminar, escurece tudo e navega
                overlay.classList.add('blackout');
                setTimeout(() => {
                    window.location.href = destinationUrl;
                }, 800); // tempo do blackout
            });
        }, 50);
    },

    // Motor do contador
    animateCounter(start, end, duration, callback) {
        const counterEl = document.getElementById('yearCounter');
        let startTime = null;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Função de easing (acelera no começo, desacelera no final)
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentYear = Math.floor(start - ((start - end) * easeOutQuart));
            
            counterEl.innerText = currentYear;

            // Efeito visual de tremor conforme o tempo passa
            if(progress > 0.3 && progress < 0.9) {
                counterEl.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px) scale(1.2)`;
            } else {
                counterEl.style.transform = `translate(0, 0) scale(1.5)`;
            }

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                counterEl.innerText = end;
                if(callback) callback();
            }
        };
        window.requestAnimationFrame(step);
    }
};

// Inicializa os componentes globais
document.addEventListener('DOMContentLoaded', () => {
    AppComponents.renderHeader();

    // Intercepta o botão de iniciar (se estiver na index.html)
    const startBtn = document.getElementById('startBtn');
    if(startBtn) {
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Aqui você manteria sua verificação de usuário logado (ex: if(!Game.state.user) return...)
            AppComponents.startTimeTravel('game.html');
        });
    }
});