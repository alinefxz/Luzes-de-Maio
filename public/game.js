// =========================================================
// LÓGICA PRINCIPAL DO JOGO - VERSÃO COM AUTENTICAÇÃO E SESSÃO
// =========================================================
const GameLogic = {
    init() {
        console.log("Iniciando Arquivo Central...");
        
        this.board = document.getElementById('gameBoard');
        this.npcOverlay = document.getElementById('npcOverlay');
        this.dialogueText = document.getElementById('npcDialogueText');
        this.invOverlay = document.getElementById('inventoryOverlay');
        this.invBody = document.getElementById('inventoryBody');
        this.invBtn = document.getElementById('inventoryBtn');
        this.closeInvBtn = document.getElementById('closeInvBtn');
        this.bgMusic = document.getElementById('bgMusic');

        this.isDialogueActive = false;
        this.currentLines = [];
        this.currentLineIndex = 0;

        // BANCO DE DADOS DE USUÁRIOS
        this.usersDB = JSON.parse(localStorage.getItem('lm_users')) || {};
        this.user = JSON.parse(localStorage.getItem('lm_currentUser')) || null;

        this.bindEvents();
        this.bindAuthEvents();

        // SE NÃO ESTIVER LOGADO: Trava o jogo e força o Login
        if (!this.user) {
            document.getElementById('playerName').innerText = "Não Identificado";
            this.openProfileModal(false);
            return; // O jogo para aqui até ocorrer um login/cadastro
        }

        // SE ESTIVER LOGADO: Configura a mesa do usuário
        document.getElementById('playerName').innerText = this.user.fullName;
        
        // Garante que o progresso carregado pertence APENAS a este usuário
        this.progress = this.user.progress || { 
            tutorialCompleted: false, 
            unlockedPhases: [1], 
            collectedEvidence: [] 
        };

        this.restoreGameState();
        this.setupLamp();
        this.setupStars();
        this.setupReviewForm();
        this.renderInventory();
        this.initAudioTrigger();

        // Diálogos Condicionais de Progresso
        if (!this.progress.tutorialCompleted) {
            this.startDialogue([
                `Olá, ${this.user.fullName.split(' ')[0]}. Sou a voz daquelas que vieram antes de você.`,
                "O Arquivo de Muzambinho está aberto. Analise as evidências nas gavetas.",
                "Mas primeiro, abra sua 'Pasta de Campo' no botão superior direito para se preparar."
            ], "tutorial_inv");
        } else {
            let nextStep = "Continue analisando a primeira ficha na gaveta.";
            if (this.progress.unlockedPhases.includes(4)) {
                nextStep = "O Relatório Final aguarda sua avaliação no menu superior.";
            } else if (this.progress.unlockedPhases.includes(3)) {
                nextStep = "A ficha 'Caso Muzambinho' está liberada para análise.";
            } else if (this.progress.unlockedPhases.includes(2)) {
                nextStep = "O 'Código de 1932' aguarda sua análise na gaveta.";
            }
            
            setTimeout(() => {
                this.startDialogue([
                    `Bem-vindo(a) de volta ao expediente, ${this.user.fullName.split(' ')[0]}.`,
                    nextStep
                ], "normal");
            }, 500);
        }
    },

    // =========================================================
    // SISTEMA DE AUTENTICAÇÃO E PERFIL
    // =========================================================
    openProfileModal(isLoggedIn) {
        this.closeAllModals();
        const m = document.getElementById('modal-profile');
        const o = document.getElementById('modalOverlay');
        const closeBtn = document.getElementById('closeProfileBtn');
        const authTabs = document.getElementById('authTabsContainer');
        const loginForm = document.getElementById('loginForm');
        const profileForm = document.getElementById('profileForm');
        const logoutContainer = document.getElementById('logoutContainer');
        const pwdContainer = document.getElementById('pwdContainer');
        const pName = document.getElementById('p_name');

        if(m && o) { m.classList.add('active'); o.classList.add('active'); }

        if (!isLoggedIn) {
            // TELA DE LOGIN/CADASTRO
            closeBtn.style.display = 'none'; // Impede fechar sem logar
            authTabs.style.display = 'flex';
            logoutContainer.style.display = 'none';
            pwdContainer.style.display = 'block';
            pName.readOnly = false;
            this.switchAuthTab('login');
        } else {
            // TELA DE EDIÇÃO DE PERFIL
            closeBtn.style.display = 'block';
            authTabs.style.display = 'none';
            loginForm.style.display = 'none';
            profileForm.style.display = 'block';
            logoutContainer.style.display = 'block';
            
            // Esconde a senha e bloqueia mudança de username na edição
            pwdContainer.style.display = 'none';
            document.getElementById('p_password').required = false;
            pName.readOnly = true;

            // Preenche os dados atuais
            document.getElementById('p_fullname').value = this.user.fullName;
            document.getElementById('p_name').value = this.user.username;
            document.getElementById('p_age').value = this.user.age;
            document.getElementById('p_gender').value = this.user.gender;
            document.getElementById('p_location').value = this.user.location;
            document.getElementById('p_occupation').value = this.user.occupation;
            document.getElementById('p_level').value = this.user.level;
            
            if(this.user.avatar) {
                const radio = document.querySelector(`input[name="p_avatar"][value="${this.user.avatar}"]`);
                if(radio) radio.checked = true;
            }
            
            document.getElementById('profileModalTitle').innerText = "Sua Credencial";
            document.getElementById('profileFormDesc').innerText = "Atualize seus dados do arquivo.";
            document.getElementById('submitProfileBtn').innerText = "Salvar Alterações";
        }
    },

    switchAuthTab(tab) {
        document.getElementById('tabLogin').classList.remove('active');
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('profileForm').style.display = 'none';

        if (tab === 'login') {
            document.getElementById('tabLogin').classList.add('active');
            document.getElementById('loginForm').style.display = 'block';
        } else {
            document.getElementById('tabRegister').classList.add('active');
            document.getElementById('profileForm').style.display = 'block';
            document.getElementById('profileModalTitle').innerText = "Acesso ao Arquivo";
            document.getElementById('submitProfileBtn').innerText = "Criar Credencial";
        }
    },

    bindAuthEvents() {
        const loginForm = document.getElementById('loginForm');
        const profileForm = document.getElementById('profileForm');

        if(loginForm) loginForm.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById('l_name').value.trim();
            const pass = document.getElementById('l_password').value;
            
            if(this.usersDB[user] && this.usersDB[user].password === pass) {
                localStorage.setItem('lm_currentUser', JSON.stringify(this.usersDB[user]));
                location.reload();
            } else {
                alert("Credencial inválida ou senha incorreta.");
            }
        };

        if(profileForm) profileForm.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById('p_name').value.trim();
            const pass = document.getElementById('p_password').value;
            const full = document.getElementById('p_fullname').value.trim();
            const age = document.getElementById('p_age').value;
            const gender = document.getElementById('p_gender').value;
            const loc = document.getElementById('p_location').value;
            const occ = document.getElementById('p_occupation').value;
            const level = document.getElementById('p_level').value;
            const avatarRadio = document.querySelector('input[name="p_avatar"]:checked');
            const avatar = avatarRadio ? avatarRadio.value : 'bertha';

            if (!this.user) {
                // CADASTRANDO NOVO USUÁRIO
                if(this.usersDB[user]) {
                    alert("Este nome de usuário já está em uso nos arquivos. Escolha outro.");
                    return;
                }
                const newUser = {
                    username: user, password: pass, fullName: full,
                    age, gender, location, occupation: occ, level, avatar,
                    progress: { tutorialCompleted: false, unlockedPhases: [1], collectedEvidence: [] }
                };
                this.usersDB[user] = newUser;
                localStorage.setItem('lm_users', JSON.stringify(this.usersDB));
                localStorage.setItem('lm_currentUser', JSON.stringify(newUser));
                location.reload();
            } else {
                // EDITANDO USUÁRIO EXISTENTE
                this.user.fullName = full;
                this.user.age = age;
                this.user.gender = gender;
                this.user.location = loc;
                this.user.occupation = occ;
                this.user.level = level;
                this.user.avatar = avatar;
                
                this.usersDB[this.user.username] = this.user;
                localStorage.setItem('lm_users', JSON.stringify(this.usersDB));
                localStorage.setItem('lm_currentUser', JSON.stringify(this.user));
                
                document.getElementById('playerName').innerText = full;
                this.playSFX('stamp');
                this.closeAllModals();
            }
        };
    },

    logout() {
        if(confirm("Deseja realmente selar o arquivo e encerrar a sessão?")) {
            localStorage.removeItem('lm_currentUser');
            location.reload();
        }
    },

    saveGameProgress() {
        if(this.user) {
            this.user.progress = this.progress;
            this.usersDB[this.user.username] = this.user;
            localStorage.setItem('lm_users', JSON.stringify(this.usersDB));
            localStorage.setItem('lm_currentUser', JSON.stringify(this.user));
        }
    },

    // =========================================================
    // RESTANTE DAS FUNÇÕES DO JOGO
    // =========================================================
    playSFX(type) {
        const sounds = {
            'stamp': 'https://www.soundjay.com/office/sounds/stamp-02.mp3',
            'paper': 'https://www.soundjay.com/button/sounds/paper-flutter-1.mp3',
            'lamp': 'https://www.soundjay.com/button/sounds/button-20.mp3',
            'error': 'https://www.soundjay.com/communication/sounds/buzzer-01.mp3'
        };
        try {
            const audio = new Audio(sounds[type]);
            audio.volume = 0.3;
            audio.play();
        } catch(e) {}
    },

    initAudioTrigger() {
        const startMusic = () => {
            if (this.bgMusic) {
                this.bgMusic.volume = 0.2;
                this.bgMusic.play().catch(() => {});
                document.removeEventListener('click', startMusic);
            }
        };
        document.addEventListener('click', startMusic);
    },

    setupLamp() {
        const lamp = document.getElementById('tableLamp');
        if(lamp) {
            lamp.onclick = (e) => {
                e.stopPropagation();
                this.playSFX('lamp');
                document.body.classList.toggle('lamp-on');
            };
        }
    },

    setupStars() {
        const stars = document.querySelectorAll('.star');
        const ratingInput = document.getElementById('ratingValue');
        const starText = document.getElementById('starValue');

        stars.forEach(star => {
            star.onclick = () => {
                const val = star.getAttribute('data-value');
                if(ratingInput) ratingInput.value = val;
                if(starText) starText.innerText = `Nota: ${val},0 / 5`;
                stars.forEach(s => {
                    s.classList.remove('active');
                    if (parseInt(s.getAttribute('data-value')) <= parseInt(val)) s.classList.add('active');
                });
            };
        });
    },

    setupReviewForm() {
        const form = document.getElementById('reviewForm');
        if(form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.playSFX('stamp');
                this.startDialogue(["Parecer enviado com sucesso. Memória preservada!"], "normal");
            };
        }
    },

    clickPhase(phaseNum) {
        if(this.isDialogueActive) return;
        this.playSFX('paper');

        const content = {
            1: { 
                t: "O Precedente Potiguar (1927)", 
                c: "<b>DOCUMENTO:</b> Carta de Celina Guimarães Viana ao Senado Federal.<br><br><i>'Invoquei o artigo 17 da Lei Eleitoral do Rio Grande do Norte, que cita apenas cidadãos, sem distinção de sexo.'</i><br><br>Este ato isolado no Nordeste rompeu o silêncio constitucional e provou que a lei não proibia o voto feminino; ela apenas o omitia por conveniência.", 
                q: "Qual foi a estratégia jurídica usada por Celina Guimarães para garantir seu alistamento em 1927?", 
                options: ["Criação de uma nova Constituição Estadual", "Interpretação da neutralidade de gênero na lei vigente", "Abaixo-assinado com 10 mil assinaturas", "Autorização direta do Presidente da República"], 
                correctIndex: 1 
            },
            2: { 
                t: "O Decreto nº 21.076 (1932)", 
                c: "<b>REGISTRO OFICIAL:</b> Promulgação do Código Eleitoral de 1932.<br><br>Embora o Código tenha garantido o sufrágio feminino, ele inicialmente continha restrições: apenas mulheres casadas (com autorização dos maridos) ou viúvas/solteiras com renda própria podiam votar.<br><br>A conquista foi histórica, mas o caminho para o sufrágio universal e sem restrições ainda estava sendo pavimentado.", 
                q: "Sobre a conquista de 1932, o que o texto revela sobre a 'igualdade' alcançada naquele momento?", 
                options: ["O voto era obrigatório para todos os homens e mulheres", "Mulheres casadas dependiam da permissão conjugal para votar", "Apenas mulheres alfabetizadas podiam ser candidatas", "O Código baniu o voto masculino para equilibrar as urnas"], 
                correctIndex: 1 
            },
            3: { 
                t: "As Luzes de Maio em Muzambinho (1933)", 
                c: "<b>ATA LOCAL:</b> 3 de maio de 1933.<br><br>Neste dia, as seções eleitorais de Muzambinho (MG) testemunharam um evento sem volta: as primeiras sul-mineiras exercendo seu poder cívico na eleição para a Assembleia Nacional Constituinte.<br><br>Os nomes de pioneiras como as da família Bueno e outras locais ficaram gravados nos livros de registro, iluminando a política da cidade sob o sol de maio.", 
                q: "Qual a importância histórica das 'Luzes de Maio' especificamente para a memória de Muzambinho?", 
                options: ["Foi a primeira vez que uma mulher foi eleita prefeita", "Marcou o início da obrigatoriedade do voto masculino", "Foi o primeiro exercício real do voto feminino após a nova lei", "Representou a fundação do primeiro partido feminino mineiro"], 
                correctIndex: 2 
            }
        };

        const data = content[phaseNum];
        if(data) {
            EvidenceSystem.spawnEvidence(data.t, data.c, { 
                phaseNum, 
                question: data.q, 
                options: data.options, 
                correctIndex: data.correctIndex 
            });
        }
    },

    addEvidenceToInventory(title, text) {
        if (!this.progress.collectedEvidence.some(e => e.title === title)) {
            this.progress.collectedEvidence.push({ title, text });
            this.saveGameProgress();
            this.renderInventory();
        }
    },

    renderInventory() {
        const body = document.getElementById('inventoryBody');
        if (!body) return;
        
        if (this.progress.collectedEvidence.length === 0) {
            body.innerHTML = `
                <div class="empty-inv-state" style="text-align:center; padding:50px 20px; opacity:0.5;">
                    <p style="font-family:var(--font-serif); font-size:1.2rem;">A pasta de campo está vazia.</p>
                    <p style="font-family:var(--font-mono); font-size:0.8rem;">Colete evidências nas gavetas para anexá-las aqui.</p>
                </div>`;
        } else {
            body.innerHTML = this.progress.collectedEvidence.map((ev, i) => {
                const rotation = i % 2 === 0 ? '-1.5deg' : '1.2deg';
                return `
                    <div class="inventory-item" style="
                        transform: rotate(${rotation});
                        background: #fffef5;
                        border: 1px solid #dcdcdc;
                        padding: 25px;
                        margin-bottom: 35px;
                        position: relative;
                        box-shadow: 5px 5px 15px rgba(0,0,0,0.1);
                        border-left: 8px solid var(--wine);
                        transition: transform 0.3s ease;
                    ">
                        <div style="position: absolute; top: -15px; right: 25px; width: 12px; height: 40px; border: 3px solid #888; border-radius: 10px; background: transparent; z-index: 2; box-shadow: 1px 1px 2px rgba(0,0,0,0.2);"></div>
                        <h4 style="font-family: var(--font-serif); color: var(--wine); font-size: 1.4rem; margin: 0 0 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">${ev.title}</h4>
                        <div style="font-family: var(--font-mono); font-size: 0.9rem; line-height: 1.6; color: #2c2c2c;">${ev.text}</div>
                        <div style="position: absolute; bottom: 10px; right: 15px; font-size: 0.6rem; font-weight: bold; color: rgba(147, 88, 94, 0.2); border: 1px solid rgba(147, 88, 94, 0.2); padding: 2px 5px; transform: rotate(-10deg);">ARQUIVO_REF_${i+1}</div>
                    </div>`;
            }).join('');
        }
    },

    restoreGameState() {
        this.progress.unlockedPhases.forEach(num => {
            const el = document.getElementById(`phase${num}`);
            if(el) {
                el.classList.remove('folder-locked');
                el.classList.add('folder-active');
                el.onclick = () => this.clickPhase(num);
                const stamp = el.querySelector('.confidential-stamp');
                if(stamp) { stamp.innerText = "LIVRE"; stamp.classList.remove('locked'); }
            }
        });
        if(this.progress.unlockedPhases.includes(4)) {
            const locked = document.getElementById('reviewLocked');
            const unlocked = document.getElementById('reviewUnlocked');
            if(locked) locked.style.display = 'none';
            if(unlocked) unlocked.style.display = 'block';
        }
    },

    unlockNextPhase(current) {
        const next = current + 1;
        if (!this.progress.unlockedPhases.includes(next)) {
            this.progress.unlockedPhases.push(next);
            this.saveGameProgress();
            this.restoreGameState();
            if(current === 3) {
                setTimeout(() => this.startDialogue(["Investigação concluída. O Relatório Final está disponível no menu superior."], "normal"), 1000);
            }
        }
    },

    bindEvents() {
        if(this.invBtn) this.invBtn.onclick = () => {
            this.invOverlay.classList.add('active');
            
            if(this.dialogueContext === "tutorial_inv_wait" || !this.progress.tutorialCompleted) {
                this.progress.tutorialCompleted = true;
                this.saveGameProgress();
                this.invBtn.classList.remove('highlight-pulse');
                
                setTimeout(() => {
                    this.startDialogue([
                        "Excelente. Sua pasta está pronta para receber as provas.",
                        "Feche a pasta e clique na Ficha 01: 'Nacional' para começar."
                    ], "normal");
                }, 500);
            }
        };

        if(this.closeInvBtn) this.closeInvBtn.onclick = () => this.invOverlay.classList.remove('active');
        
        const menuBtn = document.getElementById('menuBtn');
        if(menuBtn) menuBtn.onclick = () => document.getElementById('fullMenu').classList.add('active');
        
        const closeMenu = document.getElementById('closeMenuBtn');
        if(closeMenu) closeMenu.onclick = () => document.getElementById('fullMenu').classList.remove('active');

        document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => this.closeAllModals());

        const dialogueBox = document.querySelector('.npc-dialogue-box');
        if(dialogueBox) dialogueBox.onclick = () => this.advanceDialogue();

        document.addEventListener('keydown', (e) => {
            if (this.isDialogueActive && (e.code === 'Space' || e.code === 'Enter')) {
                e.preventDefault(); 
                this.advanceDialogue();
            }
        });
    },

    closeAllModals() {
        if (!this.user) return; // Força logar
        const o = document.getElementById('modalOverlay');
        if(o) o.classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    openModal(id) {
        if (id === 'profile') {
            this.openProfileModal(!!this.user);
            return;
        }
        this.closeAllModals();
        const menu = document.getElementById('fullMenu');
        if(menu) menu.classList.remove('active');
        const modal = document.getElementById(`modal-${id}`);
        const overlay = document.getElementById('modalOverlay');
        if(modal && overlay) { modal.classList.add('active'); overlay.classList.add('active'); }
    },

    startDialogue(lines, context) {
        this.currentLines = lines; this.currentLineIndex = 0;
        this.isDialogueActive = true; this.dialogueContext = context;
        
        if(this.dialogueText) this.dialogueText.innerText = lines[0];
        if(this.npcOverlay) this.npcOverlay.classList.add('active');
        if(this.board) this.board.classList.add('blurred');

        const modal = document.getElementById('investigationModal');
        if (modal) {
            modal.style.filter = "blur(6px) brightness(0.4)";
            modal.style.transition = "all 0.3s ease";
        }

        if (context === "tutorial_inv" && lines.length === 1) {
            if(this.invBtn) this.invBtn.classList.add('highlight-pulse');
            this.dialogueContext = "tutorial_inv_wait";
        }
    },

    advanceDialogue() {
        if (this.dialogueContext === "tutorial_inv_wait") return;

        this.currentLineIndex++;
        if(this.currentLineIndex < this.currentLines.length) {
            this.dialogueText.innerText = this.currentLines[this.currentLineIndex];
            
            if (this.dialogueContext === "tutorial_inv" && this.currentLineIndex === this.currentLines.length - 1) {
                if(this.invBtn) this.invBtn.classList.add('highlight-pulse');
                this.dialogueContext = "tutorial_inv_wait";
            }
        } else {
            this.isDialogueActive = false;
            
            if(this.npcOverlay) {
                this.npcOverlay.classList.remove('active');
                this.npcOverlay.style.zIndex = '8000';
            }
            if(this.board) this.board.classList.remove('blurred');

            const modal = document.getElementById('investigationModal');
            if (modal) {
                modal.style.filter = "none";
            }
        }
    }
};

window.GameLogic = GameLogic;
window.Game = { openModal: (id) => GameLogic.openModal(id) };

// =========================================================
// SISTEMA DE DOSSIÊ DE INVESTIGAÇÃO (ESTRUTURA DUPLA)
// =========================================================
const EvidenceSystem = {
  spawnEvidence(title, text, quizData) {
    let existing = document.getElementById('investigationModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'investigationModal';
    overlay.className = 'investigation-overlay';
    
    let quizHTML = '';
    if (quizData) {
      const optionsHTML = quizData.options.map((opt, index) => 
        `<button class="quiz-checkbox-btn" onclick="EvidenceSystem.selectAnswer(this, ${index === quizData.correctIndex}, ${quizData.phaseNum}, '${title.replace(/'/g, "\\'")}', '${text.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:10px; background:none; border:none; border-bottom:1px dotted #ccc; cursor:pointer; padding:8px; font-family:monospace; text-align:left; width:100%;">
          <span class="check-box" style="border:1px solid #000; width:16px; height:16px; display:inline-block; flex-shrink:0; position:relative;"></span>
          <span class="option-text">${opt}</span>
        </button>`
      ).join('');

      quizHTML = `
        <div class="form-header">
          <div class="form-tag" style="font-size:0.75rem; letter-spacing:2px; color:var(--wine); font-weight:bold;">LUZES DE MAIO</div>
          <h2 class="form-title" style="font-family:var(--font-serif); font-style:normal; font-weight:bold; font-size:2.4rem; margin-bottom:10px; color:var(--charcoal);">Questionário de Análise</h2>
        </div>
        <p class="quiz-question" style="font-weight:bold; margin-bottom:15px; font-size:0.95rem;">Ref. ${quizData.phaseNum}: ${quizData.question}</p>
        <div class="quiz-options">${optionsHTML}</div>
        <div class="quiz-feedback" style="margin-top:20px; text-align:center; min-height:40px; perspective:500px;"></div>
      `;
    }
    
    overlay.innerHTML = `
      <div class="investigation-dossier" id="dossierContainer">
        <div class="dossier-clip"></div>
        <button class="close-investigation" title="Fechar Pasta" onclick="this.closest('.investigation-overlay').remove()">✕</button>
        
        <div class="dossier-page page-left" style="background:#ece5d5; border-right:1px solid rgba(0,0,0,0.1);">
          <div style="padding-top: 40px; padding-left: 20px;">
              <div class="form-tag" style="margin-bottom: 20px; font-weight:bold; color:var(--wine);">DOCUMENTO APREENDIDO</div>
              <h2 class="evidence-title" style="font-family:serif; border-bottom:2px solid var(--wine); padding-bottom:5px; color:var(--charcoal); font-weight:bold;">${title}</h2>
              <div class="evidence-text" style="font-family:monospace; margin-top:20px; line-height:1.6; font-size:0.9rem;">${text}</div>
          </div>
        </div>
        <div class="dossier-page page-right" style="background:#e6dfcd; padding-top: 40px;">
          ${quizHTML}
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  selectAnswer(btn, isCorrect, phaseNum, title, text) {
    const container = btn.closest('.investigation-dossier');
    const feedback = container.querySelector('.quiz-feedback');
    const allBtns = container.querySelectorAll('.quiz-checkbox-btn');

    allBtns.forEach(b => {
      b.style.pointerEvents = 'none';
      b.style.opacity = '0.6';
    });
    
    btn.querySelector('.check-box').innerHTML = '<span style="position:absolute; top:-4px; left:2px; font-weight:900; font-size:1.2rem; color:var(--wine);">X</span>';
    btn.style.opacity = '1';

    if (isCorrect) {
      GameLogic.playSFX('stamp');
      
      container.classList.add('impact-shake');
      setTimeout(() => container.classList.remove('impact-shake'), 100);

      feedback.innerHTML = '<div class="stamp-correct stamp-animated">DEFERIDO</div>';
      
      GameLogic.addEvidenceToInventory(title, text);
      GameLogic.unlockNextPhase(phaseNum);

      setTimeout(() => {
        const modal = document.getElementById('investigationModal');
        if(modal) modal.remove();
      }, 2000);

    } else {
      GameLogic.playSFX('error');
      feedback.innerHTML = '<div class="stamp-wrong" style="border:4px double var(--wine); color:var(--wine); padding:5px 20px; font-weight:900; transform:rotate(5deg); font-family:var(--font-ui); letter-spacing:3px;">INDEFERIDO</div>';
      container.classList.add('shake-error');

      setTimeout(() => {
        container.classList.remove('shake-error');
        allBtns.forEach(b => {
          b.style.pointerEvents = 'auto';
          b.style.opacity = '1';
          b.querySelector('.check-box').innerHTML = '';
        });
        feedback.innerHTML = '';

        const npcOverlay = document.getElementById('npcOverlay');
        if (npcOverlay) npcOverlay.style.zIndex = '99999';

        const curiosities = {
            1: [
                "Atenção aos detalhes da carta: a estratégia de Celina Guimarães usou uma brecha na lei que falava apenas em 'cidadãos' e não em sexo.",
                "CURIOSIDADE LOCAL: Sabia que nos anos 1930, Muzambinho já fervilhava de cultura? O imponente Cine-Teatro local reunia a sociedade não só para a arte, mas para acaloradas discussões políticas da época!"
            ],
            2: [
                "Reveja os termos da lei: O Código de 1932 foi um marco gigantesco, mas ainda amarrava as mulheres casadas à autorização de seus maridos.",
                "CURIOSIDADE LOCAL: A famosa Estrada de Ferro Rede Sul Mineira passava bem aqui. Foi através desses trilhos de ferro que os jornais trazendo a novidade do Código Eleitoral desembarcaram na cidade!"
            ],
            3: [
                "Analise a ata com calma: foi exatamente no ano de 1933 que os primeiros votos femininos entraram oficialmente para as estatísticas de Muzambinho.",
                "CURIOSIDADE LOCAL: A imponente Igreja Matriz da cidade via as mulheres discutirem ativamente seus direitos nas calçadas após as missas dominicais, muito antes do papel oficializar esse direito."
            ]
        };

        GameLogic.startDialogue(curiosities[phaseNum], "wrong_answer");

      }, 1500);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => GameLogic.init());