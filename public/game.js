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
        this.inventoryExpandBtn = document.getElementById('inventoryExpandBtn');
        this.headerAuthBtn = document.getElementById('headerAuthBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.bgMusic = document.getElementById('bgMusic');

        this.isDialogueActive = false;
        this.currentLines = [];
        this.currentLineIndex = 0;

        // BANCO DE DADOS DE USUÁRIOS
        this.store = window.LMProfileStore;
        this.usersDB = this.store.readUsers();
        this.user = this.store.getCurrentUser();

        this.bindEvents();
        this.bindAuthEvents();

        // SE NÃO ESTIVER LOGADO: Trava o jogo e força o Login
        if (!this.user) {
            document.getElementById('playerName').innerText = "Credencial não registrada";
            this.updateHeaderAccountControls();
            this.openProfileModal(false);
            return; // O jogo para aqui até ocorrer um login/cadastro
        }

        // SE ESTIVER LOGADO: Configura a mesa do usuário
        document.getElementById('playerName').innerText = this.user.fullName;
        const headerAvatar = document.getElementById('headerAvatar');
        if(headerAvatar) {
            headerAvatar.style.display = 'flex';
            headerAvatar.innerHTML = `<img src="assets/${this.user.avatar || 'bertha'}.png" alt="${this.user.fullName}">`;
        }
        
        // Garante que o progresso carregado pertence APENAS a este usuário
        this.progress = this.store.ensureProgress(this.user.progress);
        this.syncBadges(false);
        this.updateHeaderAccountControls();

        this.restoreGameState();
        this.setupLamp();
        this.setupStars();
        this.setupReviewForm();
        this.renderInventory();
        this.renderTimeline();
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
                if(!this.isDialogueActive) {
                    this.startDialogue([
                        `Bem-vindo(a) de volta ao expediente, ${this.user.fullName.split(' ')[0]}.`,
                        nextStep
                    ], "normal");
                }
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
            document.getElementById('p_password').required = true;
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
            document.getElementById('p_name').value = this.user.name;
            document.getElementById('p_age').value = this.user.ageGroup;
            document.getElementById('p_gender').value = this.user.gender;
            document.getElementById('p_location').value = this.user.location;
            document.getElementById('p_occupation').value = this.user.occupation;
            document.getElementById('p_level').value = this.user.knowledgeLevel;
            
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
            document.getElementById('pwdContainer').style.display = this.user ? 'none' : 'block';
            document.getElementById('p_password').required = !this.user;
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

            try {
                this.user = this.store.login(user, pass);
                location.reload();
                return;
            } catch (err) {
                alert(err.message === 'bad-password' ? "Senha incorreta." : "Nome de usuario nao encontrado.");
                return;
            }
            
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

            const payload = {
                name: user,
                fullName: full,
                password: pass,
                knowledgeLevel: level,
                ageGroup: age,
                gender,
                location: loc,
                occupation: occ,
                avatar
            };

            try {
                this.user = this.user ? this.store.updateCurrentUser(payload) : this.store.register(payload);
                location.reload();
                return;
            } catch (err) {
                alert(err.message === 'duplicate-user' ? "Este nome de usuario ja esta em uso nos arquivos. Escolha outro." : "Preencha todos os dados da credencial.");
                return;
            }

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
            fetch('/api/user/logout', { method: 'POST' }).catch(() => {});
            this.store.clearCurrentUser();
            this.user = null;
            this.progress = this.store.blankProgress();
            location.reload();
        }
    },

    saveGameProgress() {
        if(this.user) {
            this.user.progress = this.progress;
            this.user = this.store.saveProgress(this.progress);
            this.usersDB = this.store.readUsers();
        }
    },

    getPhases() {
        return {
            1: {
                tab: "01. NACIONAL",
                title: "O Precedente Potiguar",
                lockedText: "O início da luta sufragista no Brasil e o impacto nacional.",
                activeText: "Leia a carta e encontre a brecha jurídica usada em 1927.",
                mode: "quiz",
                t: "O Precedente Potiguar (1927)",
                c: "<b>DOCUMENTO:</b> Carta de Celina Guimarães Viana ao Senado Federal.<br><br><i>'Invoquei o artigo 17 da Lei Eleitoral do Rio Grande do Norte, que cita apenas cidadãos, sem distinção de sexo.'</i><br><br>Este ato isolado no Nordeste rompeu o silêncio constitucional e provou que a lei não proibia o voto feminino; ela apenas o omitia por conveniência.",
                q: "Qual foi a estratégia jurídica usada por Celina Guimarães para garantir seu alistamento em 1927?",
                options: ["Criação de uma nova Constituição Estadual", "Interpretação da neutralidade de gênero na lei vigente", "Abaixo-assinado com 10 mil assinaturas", "Autorização direta do Presidente da República"],
                correctIndex: 1
            },
            2: {
                tab: "02. ORDEM",
                title: "Linha da Conquista",
                lockedText: "Conclua a etapa 01 para ordenar os marcos da conquista.",
                activeText: "Coloque os acontecimentos em ordem cronológica.",
                mode: "chronology",
                t: "Linha da Conquista (1927-1933)",
                c: "<b>DESPACHO:</b> Os documentos chegaram fora de ordem. Para entender a força do voto feminino em Muzambinho, reconstrua a sequência dos fatos nacionais e locais.",
                q: "Clique nos marcos na ordem em que aconteceram.",
                events: [
                    { id: "celina", label: "Celina Guimarães se alista no Rio Grande do Norte", year: "1927" },
                    { id: "codigo", label: "O Código Eleitoral reconhece o voto feminino", year: "1932" },
                    { id: "constituinte", label: "Mulheres votam para a Constituinte, incluindo Muzambinho", year: "1933" }
                ],
                correctOrder: ["celina", "codigo", "constituinte"]
            },
            3: {
                tab: "03. JORNAL",
                title: "Recorte de Jornal",
                lockedText: "Conclua a etapa 02 para analisar o jornal local.",
                activeText: "Selecione os trechos que realmente viram evidência.",
                mode: "highlight",
                t: "Jornal Local de Maio (1933)",
                c: "<b>RECORTE:</b> A notícia mistura observação histórica, tom de época e opinião editorial. Separe o que ajuda a provar o acontecimento.",
                q: "Marque os trechos que são evidências importantes para o dossiê.",
                snippets: [
                    { id: "data", text: "Em maio de 1933, eleitoras compareceram às seções de votação.", important: true },
                    { id: "ornamento", text: "O vestido claro de uma das presentes chamou olhares na praça.", important: false },
                    { id: "registro", text: "Os nomes foram anotados nos livros de registro eleitoral.", important: true },
                    { id: "boato", text: "Dizia-se que a cidade nunca mais seria a mesma.", important: false }
                ]
            },
            4: {
                tab: "04. CRIVO",
                title: "Fato ou Opinião",
                lockedText: "Conclua a etapa 03 para abrir o crivo histórico.",
                activeText: "Classifique afirmações antes de anexar ao arquivo.",
                mode: "factOpinion",
                t: "Crivo Histórico",
                c: "<b>CARIMBO DE ANÁLISE:</b> Nem tudo que aparece em um arquivo tem o mesmo peso. Separe fatos verificáveis de leituras opinativas.",
                q: "Classifique cada frase como fato ou opinião.",
                statements: [
                    { id: "lei", text: "O Código Eleitoral de 1932 citou o direito de voto sem distinção de sexo.", answer: "fato" },
                    { id: "maior", text: "Esse foi o momento mais bonito da política brasileira.", answer: "opiniao" },
                    { id: "muz", text: "Muzambinho participou da eleição para a Constituinte em 1933.", answer: "fato" }
                ]
            },
            5: {
                tab: "05. IMPACTO",
                title: "Mapa de Impactos",
                lockedText: "Conclua a etapa 04 para montar o mapa final.",
                activeText: "Conecte cada pista ao impacto que ela revela.",
                mode: "connections",
                t: "Mapa de Impactos em Muzambinho",
                c: "<b>MAPA FINAL:</b> O arquivo só fica completo quando cada pista aponta para o impacto histórico correto.",
                q: "Associe cada pista ao impacto mais adequado.",
                pairs: [
                    { id: "lei", clue: "Lei sem distinção de sexo", options: ["Abriu uma brecha jurídica", "Criou um jornal feminino", "Nomeou uma prefeita"], answer: "Abriu uma brecha jurídica" },
                    { id: "ata", clue: "Ata eleitoral de 1933", options: ["Prova a presença nas urnas", "Cancela o voto masculino", "Registra uma peça teatral"], answer: "Prova a presença nas urnas" },
                    { id: "jornal", clue: "Recorte de jornal local", options: ["Ajuda a reconstruir a memória pública", "Substitui a urna", "Apaga os registros oficiais"], answer: "Ajuda a reconstruir a memória pública" }
                ]
            }
        };
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
        this.reviewRating = this.progress && this.progress.finalReview ? Number(this.progress.finalReview.rating) || 0 : 0;
        this.ratingControl = window.LMRating.init('starRating', {
            initialValue: this.reviewRating,
            onChange: (value) => {
                this.reviewRating = value;
            }
        });
    },

    setupReviewForm() {
        const form = document.getElementById('reviewForm');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                if(!this.user) {
                    alert("Entre com sua credencial antes de enviar o parecer.");
                    this.openProfileModal(false);
                    return;
                }
                if(!this.reviewRating) {
                    alert("Por favor, atribua uma nota nas estrelas.");
                    return;
                }

                const review = {
                    name: this.user.name,
                    rating: this.reviewRating,
                    mechanics: document.getElementById('r_mechanics').value,
                    immersion: document.getElementById('r_immersion').value,
                    improvements: document.getElementById('r_improvements').value,
                    date: new Date().toISOString()
                };

                const submitButton = form.querySelector('[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Arquivando parecer...';
                }

                try {
                    const result = typeof this.store.saveReviewAndWait === 'function'
                        ? await this.store.saveReviewAndWait(review)
                        : { user: this.store.saveReview(review), synced: true };

                    if(!result.synced && window.location.protocol !== 'file:') {
                        throw new Error('review-sync-failed');
                    }

                    this.user = result.user;
                    this.progress = this.store.ensureProgress(this.user.progress);
                    this.usersDB = this.store.readUsers();
                    this.playSFX('stamp');
                    form.classList.add('review-saved');
                    if(submitButton) submitButton.textContent = 'Parecer arquivado';

                    setTimeout(() => {
                        this.closeAllModals();
                        this.startBackTransition('index.html');
                    }, 520);
                } catch (error) {
                    if(submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Carimbar e Anexar aos Arquivos';
                    }
                    this.showToast('Não foi possível arquivar a avaliação. Tente novamente.');
                }
            };
        }
    },

    clickPhase(phaseNum) {
        if(!this.user) {
            this.openProfileModal(false);
            return;
        }
        if(this.isDialogueActive) return;
        this.playSFX('paper');

        const phase = this.getPhases()[phaseNum];
        if(phase) {
            EvidenceSystem.spawnEvidence(phase.t, phase.c, { ...phase, phaseNum });
            return;
        }

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

    addEvidenceToInventory(title, text, answerMeta = null) {
        if (!this.progress.collectedEvidence.some(e => e.title === title)) {
            this.progress.collectedEvidence.push({ title, text, answer: answerMeta });
            this.saveGameProgress();
            this.renderInventory();
        } else if (answerMeta) {
            const evidence = this.progress.collectedEvidence.find(e => e.title === title);
            evidence.answer = answerMeta;
            this.saveGameProgress();
            this.renderInventory();
        }
    },

    recordAnswer(answerMeta) {
        if(!this.user) return;
        const savedUser = this.store.saveAnswer(answerMeta);
        if(savedUser) {
            this.user = savedUser;
            this.progress = this.store.ensureProgress(savedUser.progress);
            this.usersDB = this.store.readUsers();
        }
        this.renderInventory();
    },

    renderInventory() {
        const body = document.getElementById('inventoryBody');
        if (!body) return;
        
        if (this.progress.collectedEvidence.length === 0 && (!this.progress.answers || this.progress.answers.length === 0)) {
            body.innerHTML = `
                <div class="empty-inv-state" style="text-align:center; padding:50px 20px; opacity:0.5;">
                    <p style="font-family:var(--font-serif); font-size:1.2rem;">A pasta de campo está vazia.</p>
                    <p style="font-family:var(--font-mono); font-size:0.8rem;">Colete evidências nas gavetas para anexá-las aqui.</p>
                </div>`;
        } else {
            const evidenceTitles = new Set(this.progress.collectedEvidence.map(ev => ev.title));
            const evidenceHTML = this.progress.collectedEvidence.map((ev, i) => {
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
                        ${ev.answer ? `<div style="font-family: var(--font-mono); font-size: 0.78rem; margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(147,88,94,0.35); color: var(--wine);">RESPOSTA REGISTRADA: ${ev.answer.selectedAnswer}</div>` : ''}
                        <div style="position: absolute; bottom: 10px; right: 15px; font-size: 0.6rem; font-weight: bold; color: rgba(147, 88, 94, 0.2); border: 1px solid rgba(147, 88, 94, 0.2); padding: 2px 5px; transform: rotate(-10deg);">ARQUIVO_REF_${i+1}</div>
                    </div>`;
            }).join('');
            const answerHTML = (this.progress.answers || [])
                .filter(answer => !evidenceTitles.has(answer.title))
                .map((answer, i) => `
                    <div class="inventory-item" style="
                        transform: rotate(${i % 2 === 0 ? '1deg' : '-1deg'});
                        background: #fffef5;
                        border: 1px dashed rgba(147,88,94,0.45);
                        padding: 22px;
                        margin-bottom: 28px;
                        position: relative;
                        box-shadow: 5px 5px 15px rgba(0,0,0,0.08);
                        border-left: 8px solid var(--olive);
                    ">
                        <h4 style="font-family: var(--font-serif); color: var(--wine); font-size: 1.25rem; margin: 0 0 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Resposta - ${answer.title}</h4>
                        <div style="font-family: var(--font-mono); font-size: 0.86rem; line-height: 1.6; color: #2c2c2c;">
                            <strong>Pergunta:</strong> ${answer.question}<br>
                            <strong>Resposta:</strong> ${answer.selectedAnswer}<br>
                            <strong>Status:</strong> ${answer.isCorrect ? 'DEFERIDO' : 'INDEFERIDO'}
                        </div>
                    </div>
                `).join('');
            body.innerHTML = evidenceHTML + answerHTML;
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

    restoreGameState() {
        const phases = this.getPhases();
        Object.keys(phases).forEach(numKey => {
            const num = Number(numKey);
            const data = phases[num];
            const el = document.getElementById(`phase${num}`);
            if(el) {
                const isUnlocked = this.progress.unlockedPhases.includes(num);
                el.classList.toggle('folder-locked', !isUnlocked);
                el.classList.toggle('folder-active', isUnlocked);
                el.onclick = () => isUnlocked ? this.clickPhase(num) : this.checkLocked(data.title);
                const tab = el.querySelector('.folder-tab');
                const title = el.querySelector('h4');
                const text = el.querySelector('p');
                const stamp = el.querySelector('.confidential-stamp');
                if(tab) tab.innerText = data.tab;
                if(title) title.innerText = isUnlocked ? data.title : "Arquivo Selado";
                if(text) text.innerText = isUnlocked ? data.activeText : data.lockedText;
                if(stamp) {
                    stamp.innerText = isUnlocked ? "LIVRE" : "SIGILO";
                    stamp.classList.toggle('locked', !isUnlocked);
                }
            }
        });
        this.renderTimeline();
        if(this.progress.unlockedPhases.includes(6)) {
            const locked = document.getElementById('reviewLocked');
            const unlocked = document.getElementById('reviewUnlocked');
            if(locked) locked.style.display = 'none';
            if(unlocked) unlocked.style.display = 'block';
        }
    },

    renderTimeline(animate = false) {
        const timeline = document.getElementById('timelineStrip');
        if(!timeline || !this.progress) return;
        timeline.querySelectorAll('.timeline-item').forEach(item => {
            const phase = Number(item.dataset.phase);
            const completed = this.progress.unlockedPhases.includes(phase + 1);
            const active = this.progress.unlockedPhases.includes(phase) && !completed;
            item.classList.toggle('completed', completed);
            item.classList.toggle('active', active);
        });
        if(animate) {
            timeline.classList.remove('timeline-flash');
            void timeline.offsetWidth;
            timeline.classList.add('timeline-flash');
        }
    },

    unlockNextPhase(current) {
        const next = current + 1;
        if (!this.progress.unlockedPhases.includes(next)) {
            this.progress.unlockedPhases.push(next);
            this.saveGameProgress();
            this.restoreGameState();
            this.renderTimeline(true);
            if(current >= 5) {
                setTimeout(() => this.startDialogue(["Linha do tempo completa. O Relatório Final está disponível no menu superior."], "normal"), 1000);
            } else {
                setTimeout(() => this.startDialogue(["Linha do tempo atualizada. A próxima pasta foi liberada na gaveta."], "normal"), 1000);
            }
        }
    },

    openProfileModal(isLoggedIn) {
        const m = document.getElementById('modal-profile');
        const o = document.getElementById('modalOverlay');
        const closeBtn = document.getElementById('closeProfileBtn');
        const authTabs = document.getElementById('authTabsContainer');
        const logoutContainer = document.getElementById('logoutContainer');
        const pwdContainer = document.getElementById('pwdContainer');
        const pName = document.getElementById('p_name');

        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
        if(m && o) { m.classList.add('active'); o.classList.add('active'); }
        if(authTabs) authTabs.style.display = isLoggedIn ? 'none' : 'flex';

        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const tabProfile = document.getElementById('tabProfile');
        const tabAnswers = document.getElementById('tabAnswers');

        if (!isLoggedIn) {
            if(closeBtn) closeBtn.style.display = 'none';
            if(logoutContainer) logoutContainer.style.display = 'none';
            if(tabLogin) tabLogin.style.display = 'block';
            if(tabRegister) tabRegister.style.display = 'block';
            if(tabProfile) tabProfile.style.display = 'none';
            if(tabAnswers) tabAnswers.style.display = 'none';
            if(pwdContainer) pwdContainer.style.display = 'block';
            document.getElementById('p_password').required = true;
            if(pName) pName.readOnly = false;
            this.switchAuthTab('login');
            return;
        }

        if(closeBtn) closeBtn.style.display = 'block';
        if(logoutContainer) logoutContainer.style.display = 'none';
        if(tabLogin) tabLogin.style.display = 'none';
        if(tabRegister) tabRegister.style.display = 'none';
        if(tabProfile) tabProfile.style.display = 'none';
        if(tabAnswers) tabAnswers.style.display = 'block';
        if(pwdContainer) pwdContainer.style.display = 'none';
        document.getElementById('p_password').required = false;
        if(pName) pName.readOnly = true;

        this.fillProfileForm();
        this.renderAnswersPanel();
        this.switchAuthTab('profile');
    },

    switchAuthTab(tab) {
        ['tabLogin', 'tabRegister', 'tabProfile', 'tabAnswers'].forEach(id => {
            const btn = document.getElementById(id);
            if(btn) btn.classList.remove('active');
        });
        ['loginForm', 'profileForm', 'answersPanel', 'profileDashboard'].forEach(id => {
            const panel = document.getElementById(id);
            if(panel) panel.style.display = 'none';
        });

        const title = document.getElementById('profileModalTitle');
        const desc = document.getElementById('profileFormDesc');
        const heading = document.getElementById('profileFormHeading');
        const submit = document.getElementById('submitProfileBtn');
        const pwdContainer = document.getElementById('pwdContainer');
        const pName = document.getElementById('p_name');

        if (tab === 'login') {
            document.getElementById('tabLogin').classList.add('active');
            document.getElementById('loginForm').style.display = 'block';
            if(title) title.innerText = "Acesso ao Arquivo";
            return;
        }

        if (tab === 'register') {
            document.getElementById('tabRegister').classList.add('active');
            document.getElementById('profileForm').style.display = 'block';
            if(title) title.innerText = "Nova Credencial";
            if(heading) heading.innerText = "Credencial de campo";
            if(desc) desc.innerText = "Crie sua credencial para entrar no arquivo.";
            if(submit) submit.innerText = "Criar Credencial";
            if(pwdContainer) pwdContainer.style.display = 'block';
            document.getElementById('p_password').required = true;
            if(pName) pName.readOnly = false;
            this.updateAvatarBio();
            return;
        }

        if (tab === 'answers') {
            document.getElementById('tabAnswers').classList.add('active');
            document.getElementById('answersPanel').style.display = 'block';
            if(title) title.innerText = "Respostas do Perfil";
            this.renderAnswersPanel();
            return;
        }

        if (tab === 'profile' && this.user) {
            document.getElementById('tabProfile').classList.add('active');
            document.getElementById('profileDashboard').style.display = 'block';
            if(title) title.innerText = "Sua Credencial";
            this.renderProfileDashboard();
            return;
        }

        document.getElementById('tabProfile').classList.add('active');
        document.getElementById('profileForm').style.display = 'block';
        if(title) title.innerText = "Editar Credencial";
        if(heading) heading.innerText = "Ajustes da credencial";
        if(desc) desc.innerText = "Atualize seus dados do arquivo.";
        if(submit) submit.innerText = "Salvar Perfil";
        if(pwdContainer) pwdContainer.style.display = 'none';
        document.getElementById('p_password').required = false;
        if(pName) pName.readOnly = true;
        this.fillProfileForm();
    },

    renderAnswersPanel() {
        const list = document.getElementById('answersList');
        if(!list || !this.progress) return;
        const answers = this.progress.answers || [];
        if(answers.length === 0) {
            list.innerHTML = '<div class="answer-row">Nenhuma resposta de fase foi registrada ainda.</div>';
        } else {
            list.innerHTML = answers.map(answer => `
                <div class="answer-row">
                    <strong>${answer.title}</strong><br>
                    ${answer.selectedAnswer}<br>
                    <small>${answer.isCorrect ? 'DEFERIDO' : 'INDEFERIDO'}</small>
                </div>
            `).join('');
        }

        const review = this.progress.finalReview || {};
        document.getElementById('profile_mechanics').value = review.mechanics || '';
        document.getElementById('profile_immersion').value = review.immersion || '';
        document.getElementById('profile_improvements').value = review.improvements || '';
    },

    bindAuthEvents() {
        const loginForm = document.getElementById('loginForm');
        const profileForm = document.getElementById('profileForm');
        const answersPanel = document.getElementById('answersPanel');

        if(loginForm) loginForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const loginName = document.getElementById('l_name').value.trim();
                const loginPassword = document.getElementById('l_password').value;
                try {
                    this.user = this.store.login(loginName, loginPassword);
                } catch (err) {
                    if(err.message !== 'missing-user') throw err;
                    await this.store.loadServerUsers();
                    this.user = this.store.login(loginName, loginPassword);
                }
                location.reload();
            } catch (err) {
                alert(err.message === 'bad-password' ? "Senha incorreta." : "Nome de usuario nao encontrado.");
            }
        };

        if(profileForm) profileForm.onsubmit = (e) => {
            e.preventDefault();
            const avatarRadio = document.querySelector('input[name="p_avatar"]:checked');
            const payload = {
                name: document.getElementById('p_name').value.trim(),
                fullName: document.getElementById('p_fullname').value.trim(),
                password: document.getElementById('p_password').value,
                knowledgeLevel: document.getElementById('p_level').value,
                ageGroup: document.getElementById('p_age').value,
                gender: document.getElementById('p_gender').value,
                location: document.getElementById('p_location').value,
                occupation: document.getElementById('p_occupation').value,
                avatar: avatarRadio ? avatarRadio.value : 'bertha'
            };

            try {
                this.user = this.user ? this.store.updateCurrentUser(payload) : this.store.register(payload);
                if(!this.progress) location.reload();
                this.progress = this.store.ensureProgress(this.user.progress);
                this.updateHeaderAccountControls();
                this.syncBadges(false);
                this.renderProfileDashboard();
                this.playSFX('stamp');
                this.switchAuthTab('profile');
            } catch (err) {
                alert(err.message === 'duplicate-user' ? "Este nome de usuario ja esta em uso nos arquivos. Escolha outro." : "Preencha todos os dados da credencial.");
            }
        };

        if(answersPanel) answersPanel.onsubmit = (e) => {
            e.preventDefault();
            const currentReview = this.progress.finalReview || {};
            this.progress.finalReview = {
                ...currentReview,
                name: this.user.name,
                rating: currentReview.rating || this.reviewRating || 0,
                mechanics: document.getElementById('profile_mechanics').value,
                immersion: document.getElementById('profile_immersion').value,
                improvements: document.getElementById('profile_improvements').value,
                date: new Date().toISOString()
            };
            this.saveGameProgress();
            this.renderAnswersPanel();
            this.playSFX('stamp');
        };
    },

    bindEvents() {
        if(this.invBtn) this.invBtn.onclick = () => {
            this.setFullscreenMode(this.invOverlay, false, this.inventoryExpandBtn, 'Inventário');
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

        if(this.closeInvBtn) this.closeInvBtn.onclick = () => {
            this.invOverlay.classList.remove('active');
            this.setFullscreenMode(this.invOverlay, false, this.inventoryExpandBtn, 'Inventário');
        };

        if(this.inventoryExpandBtn) this.inventoryExpandBtn.onclick = () => {
            this.setFullscreenMode(this.invOverlay, !this.invOverlay.classList.contains('fullscreen-mode'), this.inventoryExpandBtn, 'Inventário');
        };
        
        const menuBtn = document.getElementById('menuBtn');
        if(menuBtn) menuBtn.onclick = () => document.getElementById('fullMenu').classList.add('active');
        
        const closeMenu = document.getElementById('closeMenuBtn');
        if(closeMenu) closeMenu.onclick = () => document.getElementById('fullMenu').classList.remove('active');

        if(this.headerAuthBtn) this.headerAuthBtn.onclick = () => this.openProfileModal(!!this.user);
        if(this.logoutBtn) this.logoutBtn.onclick = () => this.logout();
        document.getElementById('editProfileBtn')?.addEventListener('click', () => this.switchAuthTab('edit'));
        document.getElementById('resetProgressBtn')?.addEventListener('click', () => this.resetProgress());
        document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.deleteAccount());
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
        const o = document.getElementById('modalOverlay');
        if(o) o.classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    setFullscreenMode(target, expanded, button, label = 'Janela') {
        if(!target) return;
        target.classList.toggle('fullscreen-mode', expanded);
        if(button) {
            button.setAttribute('aria-pressed', expanded ? 'true' : 'false');
            button.setAttribute('aria-label', expanded ? `Reduzir ${label}` : `Expandir ${label}`);
            button.setAttribute('title', expanded ? `Reduzir ${label}` : `Expandir ${label}`);
            button.innerHTML = expanded ? '&#x2921;' : '&#x26F6;';
        }
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
window.Game = window.Game || {};
window.Game.openModal = (id) => GameLogic.openModal(id);
try { Game.openModal = window.Game.openModal; } catch (e) {}

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
        `<button class="quiz-checkbox-btn" onclick="EvidenceSystem.selectAnswer(this, ${index === quizData.correctIndex}, ${quizData.phaseNum}, '${title.replace(/'/g, "\\'")}', '${text.replace(/'/g, "\\'")}', '${quizData.question.replace(/'/g, "\\'")}', '${opt.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:10px; background:none; border:none; border-bottom:1px dotted #ccc; cursor:pointer; padding:8px; font-family:monospace; text-align:left; width:100%;">
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

  selectAnswer(btn, isCorrect, phaseNum, title, text, question, selectedAnswer) {
    const container = btn.closest('.investigation-dossier');
    const feedback = container.querySelector('.quiz-feedback');
    const allBtns = container.querySelectorAll('.quiz-checkbox-btn');

    allBtns.forEach(b => {
      b.style.pointerEvents = 'none';
      b.style.opacity = '0.6';
    });
    
    btn.querySelector('.check-box').innerHTML = '<span style="position:absolute; top:-4px; left:2px; font-weight:900; font-size:1.2rem; color:var(--wine);">X</span>';
    btn.style.opacity = '1';

    const answerMeta = { phaseNum, title, question, selectedAnswer, isCorrect };
    GameLogic.recordAnswer(answerMeta);

    if (isCorrect) {
      GameLogic.playSFX('stamp');
      
      container.classList.add('impact-shake');
      setTimeout(() => container.classList.remove('impact-shake'), 100);

      feedback.innerHTML = '<div class="stamp-correct stamp-animated">DEFERIDO</div>';
      
      GameLogic.addEvidenceToInventory(title, text, answerMeta);
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

EvidenceSystem.escapeHTML = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

EvidenceSystem.spawnEvidence = function(title, text, phaseData) {
  let existing = document.getElementById('investigationModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'investigationModal';
  overlay.className = 'investigation-overlay';
  const activityHTML = this.renderActivity(phaseData);

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
        <div class="form-header">
          <div class="form-tag" style="font-size:0.75rem; letter-spacing:2px; color:var(--wine); font-weight:bold;">LUZES DE MAIO</div>
          <h2 class="form-title" style="font-family:var(--font-serif); font-style:normal; font-weight:bold; font-size:2.4rem; margin-bottom:10px; color:var(--charcoal);">Questionário de Análise</h2>
        </div>
        <p class="quiz-question" style="font-weight:bold; margin-bottom:15px; font-size:0.95rem;">${phaseData.q}</p>
        <div class="activity-area">${activityHTML}</div>
        <div class="quiz-feedback" style="margin-top:20px; text-align:center; min-height:40px; perspective:500px;"></div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  this.bindActivity(overlay, title, text, phaseData);
};

EvidenceSystem.renderActivity = function(data) {
  if(data.mode === 'chronology') {
    return `
      <div class="activity-order-note typewriter" style="font-size:0.8rem; margin-bottom:10px;">Clique nos marcos na ordem correta.</div>
      ${data.events.map(item => `
        <button class="activity-card" type="button" data-order-id="${item.id}">
          <strong>${item.year}</strong><br>${this.escapeHTML(item.label)}
        </button>
      `).join('')}
      <button class="btn-primary activity-submit" type="button" data-submit-activity>Carimbar ordem</button>`;
  }

  if(data.mode === 'highlight') {
    return `
      <div class="activity-order-note typewriter" style="font-size:0.8rem; margin-bottom:10px;">Marque os trechos que viram prova.</div>
      ${data.snippets.map(item => `
        <button class="activity-card" type="button" data-highlight-id="${item.id}">
          ${this.escapeHTML(item.text)}
        </button>
      `).join('')}
      <button class="btn-primary activity-submit" type="button" data-submit-activity>Carimbar recorte</button>`;
  }

  if(data.mode === 'factOpinion') {
    return data.statements.map(item => `
      <div class="activity-card" data-statement-id="${item.id}">
        ${this.escapeHTML(item.text)}
        <div class="choice-row">
          <button class="mini-action-btn" type="button" data-value="fato">Fato</button>
          <button class="mini-action-btn" type="button" data-value="opiniao">Opinião</button>
        </div>
      </div>
    `).join('') + '<button class="btn-primary activity-submit" type="button" data-submit-activity>Carimbar crivo</button>';
  }

  if(data.mode === 'connections') {
    return data.pairs.map(item => `
      <div class="activity-card" data-pair-id="${item.id}">
        <strong>${this.escapeHTML(item.clue)}</strong>
        <div class="choice-row">
          ${item.options.map(option => `<button class="mini-action-btn" type="button" data-value="${this.escapeHTML(option)}">${this.escapeHTML(option)}</button>`).join('')}
        </div>
      </div>
    `).join('') + '<button class="btn-primary activity-submit" type="button" data-submit-activity>Carimbar mapa</button>';
  }

  return data.options.map((opt, index) => `
    <button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}" style="display:flex; align-items:center; gap:10px; background:none; border:none; border-bottom:1px dotted #ccc; cursor:pointer; padding:8px; font-family:monospace; text-align:left; width:100%;">
      <span class="check-box" style="border:1px solid #000; width:16px; height:16px; display:inline-block; flex-shrink:0; position:relative;"></span>
      <span class="option-text">${this.escapeHTML(opt)}</span>
    </button>
  `).join('');
};

EvidenceSystem.bindActivity = function(overlay, title, text, data) {
  const state = { order: [], selected: new Set(), answers: {} };

  const finish = (isCorrect, selectedAnswer) => {
    const feedback = overlay.querySelector('.quiz-feedback');
    const answerMeta = { phaseNum: data.phaseNum, title, question: data.q, selectedAnswer, isCorrect };
    GameLogic.recordAnswer(answerMeta);

    if(isCorrect) {
      GameLogic.playSFX('stamp');
      feedback.innerHTML = '<div class="stamp-correct stamp-animated">DEFERIDO</div>';
      GameLogic.addEvidenceToInventory(title, text, answerMeta);
      GameLogic.unlockNextPhase(data.phaseNum);
      setTimeout(() => {
        const modal = document.getElementById('investigationModal');
        if(modal) modal.remove();
      }, 2000);
    } else {
      GameLogic.playSFX('error');
      feedback.innerHTML = '<div class="stamp-wrong" style="border:4px double var(--wine); color:var(--wine); padding:5px 20px; font-weight:900; transform:rotate(5deg); font-family:var(--font-ui); letter-spacing:3px;">INDEFERIDO</div>';
      setTimeout(() => { feedback.innerHTML = ''; }, 1500);
    }
  };

  overlay.querySelectorAll('[data-quiz-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.quizIndex);
      overlay.querySelectorAll('[data-quiz-index]').forEach(btn => btn.style.opacity = '0.6');
      button.style.opacity = '1';
      const box = button.querySelector('.check-box');
      if(box) box.innerHTML = '<span style="position:absolute; top:-4px; left:2px; font-weight:900; font-size:1.2rem; color:var(--wine);">X</span>';
      finish(index === data.correctIndex, data.options[index]);
    });
  });

  overlay.querySelectorAll('[data-order-id]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.orderId;
      if(state.order.includes(id)) return;
      state.order.push(id);
      button.classList.add('selected');
      button.insertAdjacentHTML('afterbegin', `<span style="float:right; font-weight:900; color:var(--wine);">${state.order.length}</span>`);
    });
  });

  overlay.querySelectorAll('[data-highlight-id]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.highlightId;
      if(state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      button.classList.toggle('selected');
    });
  });

  overlay.querySelectorAll('[data-statement-id], [data-pair-id]').forEach(card => {
    card.querySelectorAll('[data-value]').forEach(button => {
      button.addEventListener('click', () => {
        const id = card.dataset.statementId || card.dataset.pairId;
        state.answers[id] = button.dataset.value;
        card.classList.add('answered');
        card.querySelectorAll('[data-value]').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
      });
    });
  });

  const submit = overlay.querySelector('[data-submit-activity]');
  if(submit) submit.addEventListener('click', () => {
    if(data.mode === 'chronology') {
      const selectedAnswer = state.order.map(id => data.events.find(item => item.id === id)?.label || id).join(' → ');
      const correct = state.order.join('|') === data.correctOrder.join('|');
      if(!correct) {
        state.order = [];
        overlay.querySelectorAll('[data-order-id]').forEach(button => {
          button.classList.remove('selected');
          const marker = button.querySelector('span');
          if(marker) marker.remove();
        });
      }
      finish(correct, selectedAnswer || 'Sem ordem definida');
    }

    if(data.mode === 'highlight') {
      const correctIds = data.snippets.filter(item => item.important).map(item => item.id).sort();
      const selectedIds = Array.from(state.selected).sort();
      const selectedAnswer = selectedIds.map(id => data.snippets.find(item => item.id === id)?.text || id).join(' | ');
      finish(correctIds.join('|') === selectedIds.join('|'), selectedAnswer || 'Nenhum trecho selecionado');
    }

    if(data.mode === 'factOpinion') {
      const complete = data.statements.every(item => state.answers[item.id]);
      const correct = complete && data.statements.every(item => state.answers[item.id] === item.answer);
      const selectedAnswer = data.statements.map(item => `${item.text}: ${state.answers[item.id] || 'sem resposta'}`).join(' | ');
      finish(correct, selectedAnswer);
    }

    if(data.mode === 'connections') {
      const complete = data.pairs.every(item => state.answers[item.id]);
      const correct = complete && data.pairs.every(item => state.answers[item.id] === item.answer);
      const selectedAnswer = data.pairs.map(item => `${item.clue}: ${state.answers[item.id] || 'sem resposta'}`).join(' | ');
      finish(correct, selectedAnswer);
    }
  });
};

GameLogic.getChapters = function() {
  return [
    {
      number: "I",
      title: "Abrindo o Arquivo",
      label: "Capítulo I • A Brecha",
      timeline: [
        { date: "1927", text: "Celina Guimarães usa a neutralidade da lei para se alistar." },
        { date: "1932", text: "O Código Eleitoral brasileiro permite o voto feminino." },
        { date: "Início 1933", text: "Mulheres começam a organizar documentos e alistamento eleitoral." },
        { date: "Maio 1933", text: "A cidade entra na primeira eleição com participação feminina." }
      ],
      phases: [
        {
          tab: "01. CARTA",
          title: "O Precedente Potiguar",
          activeText: "Leia a carta e encontre a brecha jurídica usada em 1927.",
          lockedText: "Abra a primeira ficha para iniciar o arquivo.",
          mode: "quiz",
          t: "O Precedente Potiguar (1927)",
          c: "<b>DOCUMENTO:</b> Carta de Celina Guimarães Viana ao Senado Federal.<br><br><i>'Invoquei o artigo 17 da Lei Eleitoral do Rio Grande do Norte, que cita apenas cidadãos, sem distinção de sexo.'</i><br><br>Este ato provou que a lei não proibia o voto feminino; ela apenas o omitia por conveniência.",
          q: "Qual foi a estratégia jurídica usada por Celina Guimarães para garantir seu alistamento em 1927?",
          options: ["Criação de uma nova Constituição Estadual", "Interpretação da neutralidade de gênero na lei vigente", "Abaixo-assinado com 10 mil assinaturas", "Autorização direta do Presidente da República"],
          correctIndex: 1
        },
        {
          tab: "02. ORDEM",
          title: "Linha da Conquista",
          activeText: "Coloque os acontecimentos em ordem cronológica.",
          lockedText: "Conclua a carta para ordenar os marcos.",
          mode: "chronology",
          t: "Linha da Conquista (1927-1933)",
          c: "<b>DESPACHO:</b> Os documentos chegaram fora de ordem. Reconstrua a sequência para entender como a conquista chegou até Muzambinho.",
          q: "Clique nos marcos na ordem em que aconteceram.",
          events: [
            { id: "celina", label: "Celina Guimarães se alista no Rio Grande do Norte", year: "1927" },
            { id: "codigo", label: "O Código Eleitoral reconhece o voto feminino", year: "1932" },
            { id: "constituinte", label: "Mulheres votam para a Constituinte, incluindo Muzambinho", year: "1933" }
          ],
          correctOrder: ["celina", "codigo", "constituinte"]
        },
        {
          tab: "03. JORNAL",
          title: "Recorte de Jornal",
          activeText: "Selecione os trechos que realmente viram evidência.",
          lockedText: "Ordene a linha para abrir o recorte.",
          mode: "highlight",
          t: "Jornal Local de Maio (1933)",
          c: "<b>RECORTE:</b> A notícia mistura observação histórica, tom de época e opinião editorial. Separe o que ajuda a provar o acontecimento.",
          q: "Marque os trechos que são evidências importantes para o dossiê.",
          snippets: [
            { id: "data", text: "Em maio de 1933, eleitoras compareceram às seções de votação.", important: true },
            { id: "ornamento", text: "O vestido claro de uma das presentes chamou olhares na praça.", important: false },
            { id: "registro", text: "Os nomes foram anotados nos livros de registro eleitoral.", important: true },
            { id: "boato", text: "Dizia-se que a cidade nunca mais seria a mesma.", important: false }
          ]
        },
        {
          tab: "04. CRIVO",
          title: "Fato ou Opinião",
          activeText: "Classifique afirmações antes de anexar ao arquivo.",
          lockedText: "Analise o jornal para abrir o crivo.",
          mode: "factOpinion",
          t: "Crivo Histórico",
          c: "<b>CARIMBO DE ANÁLISE:</b> Nem tudo que aparece em um arquivo tem o mesmo peso. Separe fatos verificáveis de leituras opinativas.",
          q: "Classifique cada frase como fato ou opinião.",
          statements: [
            { id: "lei", text: "O Código Eleitoral de 1932 citou o direito de voto sem distinção de sexo.", answer: "fato" },
            { id: "maior", text: "Esse foi o momento mais bonito da política brasileira.", answer: "opiniao" },
            { id: "muz", text: "Muzambinho participou da eleição para a Constituinte em 1933.", answer: "fato" }
          ]
        }
      ]
    },
    {
      number: "II",
      title: "Muzambinho em Movimento",
      label: "Capítulo II • A Cidade",
      timeline: [
        { date: "Início 1933", text: "A notícia do novo direito circula entre famílias e escolas." },
        { date: "Abril 1933", text: "Documentos de alistamento passam a aparecer nas seções eleitorais." },
        { date: "Maio 1933", text: "Comparecimento feminino surpreende a cidade." },
        { date: "Pós-eleição", text: "Atas e jornais preservam rastros da participação local." }
      ],
      phases: [
        {
          tab: "05. MAPA",
          title: "Mapa de Impactos",
          activeText: "Conecte cada pista ao impacto que ela revela.",
          lockedText: "Complete o Capítulo I para abrir outra gaveta.",
          mode: "connections",
          t: "Mapa de Impactos em Muzambinho",
          c: "<b>MAPA FINAL:</b> O arquivo só fica completo quando cada pista aponta para o impacto histórico correto.",
          q: "Associe cada pista ao impacto mais adequado.",
          pairs: [
            { id: "lei", clue: "Lei sem distinção de sexo", options: ["Abriu uma brecha jurídica", "Criou um jornal feminino", "Nomeou uma prefeita"], answer: "Abriu uma brecha jurídica" },
            { id: "ata", clue: "Ata eleitoral de 1933", options: ["Prova a presença nas urnas", "Cancela o voto masculino", "Registra uma peça teatral"], answer: "Prova a presença nas urnas" },
            { id: "jornal", clue: "Recorte de jornal local", options: ["Ajuda a reconstruir a memória pública", "Substitui a urna", "Apaga os registros oficiais"], answer: "Ajuda a reconstruir a memória pública" }
          ]
        },
        {
          tab: "06. ATA",
          title: "Ata de Alistamento",
          activeText: "Identifique o detalhe que comprova participação cívica.",
          lockedText: "Resolva o mapa para abrir esta ata.",
          mode: "quiz",
          t: "Ata de Alistamento Local",
          c: "<b>ATA:</b> Entre assinaturas e carimbos, aparece a indicação de eleitoras recém-alistadas para a eleição da Constituinte.",
          q: "Qual detalhe da ata tem maior força como prova histórica?",
          options: ["A cor do papel", "A presença de nomes registrados e carimbados", "O tamanho da mesa eleitoral", "A caligrafia mais bonita"],
          correctIndex: 1
        },
        {
          tab: "07. ROTAS",
          title: "Rotas da Notícia",
          activeText: "Organize como a informação percorreu a cidade.",
          lockedText: "Leia a ata para abrir as rotas.",
          mode: "chronology",
          t: "Rotas da Notícia",
          c: "<b>MAPA:</b> A novidade não chegou de uma vez. Ela circulou por jornal, escola, conversa pública e cartório eleitoral.",
          q: "Ordene a circulação provável da notícia.",
          events: [
            { id: "jornal", label: "Jornal anuncia o novo Código Eleitoral", year: "1" },
            { id: "conversa", label: "Professoras e famílias discutem o alistamento", year: "2" },
            { id: "cartorio", label: "Eleitoras procuram registro eleitoral", year: "3" }
          ],
          correctOrder: ["jornal", "conversa", "cartorio"]
        },
        {
          tab: "08. MARGEM",
          title: "Anotações de Margem",
          activeText: "Marque as observações que ajudam a investigação.",
          lockedText: "Organize as rotas para abrir as margens.",
          mode: "highlight",
          t: "Anotações na Margem",
          c: "<b>FOLHA AVULSA:</b> As bordas do arquivo têm observações úteis e distrações de época.",
          q: "Selecione apenas as anotações que ajudam a explicar o voto feminino.",
          snippets: [
            { id: "alistamento", text: "Alistamento eleitoral feminino aparece ligado à eleição de 1933.", important: true },
            { id: "clima", text: "O dia amanheceu claro, com vento na praça.", important: false },
            { id: "reacao", text: "Parte da cidade estranhou a presença feminina nas seções.", important: true },
            { id: "tinta", text: "A tinta do cartaz parecia mais escura que a usual.", important: false }
          ]
        }
      ]
    },
    {
      number: "III",
      title: "Memória Preservada",
      label: "Capítulo III • O Legado",
      timeline: [
        { date: "1933", text: "Votar deixa de ser rumor e vira registro." },
        { date: "Depois de maio", text: "As atas ajudam a provar presença e participação." },
        { date: "Memória local", text: "O arquivo liga a conquista nacional à experiência de Muzambinho." },
        { date: "Hoje", text: "A investigação transforma registro em memória pública." }
      ],
      phases: [
        {
          tab: "09. BOATO",
          title: "Boato ou Registro",
          activeText: "Separe afirmações verificáveis de opinião pública.",
          lockedText: "Complete o Capítulo II para abrir a memória.",
          mode: "factOpinion",
          t: "Boato ou Registro",
          c: "<b>CONFERÊNCIA:</b> O arquivo guarda frases repetidas pela cidade. Algumas são provas, outras são impressões.",
          q: "Classifique cada frase como fato ou opinião.",
          statements: [
            { id: "registro", text: "O comparecimento pode ser conferido por atas e listas.", answer: "fato" },
            { id: "assombro", text: "Todos ficaram encantados com a cena.", answer: "opiniao" },
            { id: "direito", text: "O voto feminino foi reconhecido pelo Código Eleitoral.", answer: "fato" }
          ]
        },
        {
          tab: "10. ELOS",
          title: "Elo das Pioneiras",
          activeText: "Associe pessoa, documento e impacto.",
          lockedText: "Resolva boatos e registros para abrir os elos.",
          mode: "connections",
          t: "Elo das Pioneiras",
          c: "<b>FICHÁRIO:</b> Cada pioneira abre uma trilha de leitura: lei, registro, memória e permanência.",
          q: "Ligue cada pista ao impacto correto.",
          pairs: [
            { id: "celina", clue: "Celina Guimarães", options: ["Mostrou a brecha legal", "Escreveu a ata de Muzambinho", "Organizou o museu"], answer: "Mostrou a brecha legal" },
            { id: "codigo", clue: "Código Eleitoral", options: ["Transformou brecha em direito reconhecido", "Criou a imprensa local", "Cancelou eleições"], answer: "Transformou brecha em direito reconhecido" },
            { id: "arquivo", clue: "Ata local", options: ["Prende a memória ao território", "Escolhe a roupa das eleitoras", "Define a praça"], answer: "Prende a memória ao território" }
          ]
        },
        {
          tab: "11. SELO",
          title: "Selo Final",
          activeText: "Escolha o selo que resume o documento.",
          lockedText: "Ligue os elos para abrir o selo.",
          mode: "quiz",
          t: "Selo Final do Arquivo",
          c: "<b>CARIMBO:</b> Antes do encerramento, o dossiê precisa receber o selo correto.",
          q: "Qual selo resume melhor o sentido histórico do arquivo?",
          options: ["Curiosidade sem prova", "Memória cívica recuperada", "Documento irrelevante", "Registro apenas decorativo"],
          correctIndex: 1
        },
        {
          tab: "12. SÍNTESE",
          title: "Síntese da Memória",
          activeText: "Selecione as frases que fecham o argumento.",
          lockedText: "Escolha o selo para abrir a síntese.",
          mode: "highlight",
          t: "Síntese da Memória",
          c: "<b>RELATÓRIO:</b> A última página deve registrar somente as conclusões sustentadas pelo arquivo.",
          q: "Marque as frases que podem entrar na conclusão final.",
          snippets: [
            { id: "nacional", text: "A conquista nacional abriu caminho para participação local.", important: true },
            { id: "moda", text: "A cor das roupas explica o resultado da eleição.", important: false },
            { id: "muz", text: "Muzambinho integra a história concreta do voto feminino em 1933.", important: true },
            { id: "memoria", text: "Preservar atas e jornais ajuda a manter a memória pública viva.", important: true }
          ]
        }
      ]
    }
  ];
};

GameLogic.getPhaseList = function() {
  return this.getChapters().flatMap((chapter, chapterIndex) =>
    chapter.phases.map((phase, phaseIndex) => ({
      ...phase,
      phaseNum: chapterIndex * 4 + phaseIndex + 1,
      chapterIndex,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title
    }))
  );
};

GameLogic.getPhases = function() {
  return this.getPhaseList().reduce((map, phase) => {
    map[phase.phaseNum] = phase;
    return map;
  }, {});
};

GameLogic.getActiveChapterIndex = function() {
  const highest = Math.max(...(this.progress?.unlockedPhases || [1]).filter(num => num <= this.getPhaseList().length));
  return Math.min(this.getChapters().length - 1, Math.max(0, Math.floor((highest - 1) / 4)));
};

GameLogic.renderDrawer = function() {
  const drawer = document.querySelector('.drawer-inside');
  if(!drawer) return;

  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  const chapters = this.getChapters();
  const chapter = chapters[this.currentChapterIndex];
  const phases = this.getPhaseList().filter(phase => phase.chapterIndex === this.currentChapterIndex);
  const unlocked = this.progress?.unlockedPhases || [1];

  drawer.innerHTML = phases.map((phase, index) => {
    const isUnlocked = unlocked.includes(phase.phaseNum);
    const tabClass = index === 1 ? 'tab-center' : (index === 2 ? 'tab-right' : '');
    return `
      <button class="file-folder ${isUnlocked ? 'folder-active' : 'folder-locked'}" id="phase${phase.phaseNum}" type="button" data-locked="${!isUnlocked}" onclick="${isUnlocked ? `GameLogic.clickPhase(${phase.phaseNum})` : `GameLogic.checkLocked('${phase.title.replace(/'/g, "\\'")}')`}">
        <div class="folder-tab ${tabClass}">${phase.tab}</div>
        <div class="folder-paper">
          <div class="paper-clip"></div>
          <h4>${isUnlocked ? phase.title : 'Arquivo Selado'}</h4>
          <p>${isUnlocked ? phase.activeText : phase.lockedText}</p>
          <span class="confidential-stamp ${isUnlocked ? '' : 'locked'}">${isUnlocked ? 'LIVRE' : 'SIGILO'}</span>
        </div>
      </button>
    `;
  }).join('');

  const label = document.getElementById('drawerLabel');
  if(label) {
    label.innerHTML = `
      <span>Capítulo ${chapter.number}</span>
      <strong>${chapter.title}</strong>
      <small>Gaveta ${this.currentChapterIndex + 1} de ${chapters.length}</small>
    `;
  }
  const prev = document.getElementById('prevDrawerBtn');
  const next = document.getElementById('nextDrawerBtn');
  if(prev) {
    prev.disabled = this.currentChapterIndex === 0;
    prev.classList.toggle('is-locked', false);
    prev.setAttribute('aria-disabled', String(this.currentChapterIndex === 0));
  }
  if(next) {
    const isLast = this.currentChapterIndex >= chapters.length - 1;
    const nextIsOpen = this.isChapterAvailable(this.currentChapterIndex + 1);
    next.disabled = isLast;
    next.classList.toggle('is-locked', !isLast && !nextIsOpen);
    next.setAttribute('aria-disabled', String(isLast));
    next.dataset.locked = String(!isLast && !nextIsOpen);
    next.title = !isLast && !nextIsOpen ? 'Conclua este capítulo antes de abrir a próxima gaveta.' : 'Avançar para a próxima gaveta';
  }

  let kicker = document.querySelector('.chapter-kicker');
  if(!kicker) {
    kicker = document.createElement('div');
    kicker.className = 'chapter-kicker';
    const cabinet = document.querySelector('.steel-cabinet');
    if(cabinet) cabinet.appendChild(kicker);
  }
  kicker.innerHTML = `<span>Capítulo ${chapter.number}</span><strong>${chapter.title}</strong>`;
};

GameLogic.isChapterAvailable = function(chapterIndex) {
  const chapters = this.getChapters();
  if(chapterIndex <= 0) return true;
  if(chapterIndex >= chapters.length) return false;
  const firstPhase = chapterIndex * 4 + 1;
  return (this.progress?.unlockedPhases || [1]).includes(firstPhase);
};

GameLogic.showSuffragistWarning = function(lines, context = "locked") {
  const messageLines = Array.isArray(lines) ? lines : [lines];
  if(this.isDialogueActive) {
    this.currentLines = messageLines;
    this.currentLineIndex = 0;
    this.dialogueContext = context;
    if(this.dialogueText) this.dialogueText.innerText = messageLines[0];
    if(this.npcOverlay) this.npcOverlay.classList.add('active');
    if(this.board) this.board.classList.add('blurred');
    return;
  }
  this.startDialogue(messageLines, context);
};

GameLogic.warnLockedChapter = function(chapterIndex) {
  const chapters = this.getChapters();
  const target = chapters[chapterIndex];
  const previous = chapters[chapterIndex - 1];
  const previousName = previous ? previous.title : "a gaveta anterior";
  const targetName = target ? target.title : "a próxima gaveta";
  this.showSuffragistWarning([
    `Essa gaveta ainda está lacrada: ${targetName}.`,
    `Conclua primeiro o capítulo anterior, "${previousName}", para que o arquivo libere a próxima parte.`
  ], "locked_chapter");
};

GameLogic.checkLocked = function(phaseName = "esta ficha") {
  const phase = this.getPhaseList().find(item => item.title === phaseName);
  const chapterName = phase ? phase.chapterTitle : "este capítulo";
  this.showSuffragistWarning([
    `Ainda não dá para abrir "${phaseName}".`,
    `Siga a ordem do arquivo: termine a ficha liberada em ${chapterName} e esta gaveta se abrirá.`
  ], "locked_phase");
};

GameLogic.changeDrawer = function(direction) {
  const chapters = this.getChapters();
  const targetIndex = Math.max(0, Math.min(chapters.length - 1, (this.currentChapterIndex || 0) + direction));
  if(targetIndex === this.currentChapterIndex) return;
  if(direction > 0 && !this.isChapterAvailable(targetIndex)) {
    this.warnLockedChapter(targetIndex);
    this.renderDrawer();
    return;
  }
  this.currentChapterIndex = targetIndex;
  this.renderDrawer();
  this.renderTimeline();
};

GameLogic.restoreGameState = function() {
  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  this.renderDrawer();
  this.renderTimeline();
  const locked = document.getElementById('reviewLocked');
  const unlocked = document.getElementById('reviewUnlocked');
  const finalPhase = this.getPhaseList().length + 1;
  if(locked && unlocked) {
    const canReview = this.progress.unlockedPhases.includes(finalPhase);
    locked.style.display = canReview ? 'none' : 'block';
    unlocked.style.display = canReview ? 'block' : 'none';
  }
};

GameLogic.renderTimeline = function(animate = false) {
  const timeline = document.getElementById('timelineStrip');
  if(!timeline || !this.progress) return;
  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  const chapter = this.getChapters()[this.currentChapterIndex];
  const phases = this.getPhaseList().filter(phase => phase.chapterIndex === this.currentChapterIndex);
  timeline.innerHTML = `<div class="timeline-track"></div>${chapter.timeline.map((entry, index) => {
    const phaseNum = phases[index]?.phaseNum || (this.currentChapterIndex * 4 + index + 1);
    const completed = this.progress.unlockedPhases.includes(phaseNum + 1);
    const active = this.progress.unlockedPhases.includes(phaseNum) && !completed;
    return `<div class="timeline-item ${completed ? 'completed' : ''} ${active ? 'active' : ''}" data-phase="${phaseNum}"><span>${entry.date}</span><small>${entry.text}</small></div>`;
  }).join('')}`;
  if(animate) {
    timeline.classList.remove('timeline-flash');
    void timeline.offsetWidth;
    timeline.classList.add('timeline-flash');
  }
};

GameLogic.showChapterTimeline = function(chapterIndex, nextChapterIndex = null) {
  const chapter = this.getChapters()[chapterIndex];
  if(!chapter) return;
  const existing = document.getElementById('chapterTimelineOverlay');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'chapter-timeline-overlay';
  overlay.id = 'chapterTimelineOverlay';
  if(nextChapterIndex !== null) overlay.dataset.nextChapterIndex = String(nextChapterIndex);
  overlay.innerHTML = `
    <div class="chapter-timeline-card">
      <div class="chapter-timeline-eyebrow">Capítulo ${chapter.number} completo</div>
      <h2 class="chapter-timeline-title">Linha do Tempo Descoberta</h2>
      <p class="chapter-timeline-subtitle">${chapter.title}</p>
      <div class="chapter-timeline-list">
        ${chapter.timeline.map(entry => `
          <div class="chapter-timeline-entry">
            <strong>${entry.date}</strong>
            <span>${entry.text}</span>
          </div>
        `).join('')}
      </div>
      <button class="vintage-plate-btn" type="button" onclick="GameLogic.closeChapterTimeline()">
        <span class="plate-screw screw-left"></span>
        GUARDAR NO DOSSIÊ
        <span class="plate-screw screw-right"></span>
      </button>
    </div>`;
  document.body.appendChild(overlay);
};

GameLogic.closeChapterTimeline = function() {
  const overlay = document.getElementById('chapterTimelineOverlay');
  if(!overlay) return false;
  const nextChapterIndex = overlay.dataset.nextChapterIndex ? Number(overlay.dataset.nextChapterIndex) : null;
  overlay.remove();

  if(Number.isInteger(nextChapterIndex) && this.isChapterAvailable(nextChapterIndex)) {
    this.currentChapterIndex = nextChapterIndex;
    this.restoreGameState();
    setTimeout(() => {
      const chapter = this.getChapters()[nextChapterIndex];
      if(chapter) this.startDialogue([`Nova gaveta aberta: ${chapter.title}.`], "normal");
    }, 250);
  }

  return true;
};

GameLogic.unlockNextPhase = function(current, options = {}) {
  const total = this.getPhaseList().length;
  const next = current + 1;
  if (!this.progress.unlockedPhases.includes(next)) {
    this.progress.unlockedPhases.push(next);
    this.saveGameProgress();
    this.currentChapterIndex = Math.min(this.getChapters().length - 1, Math.floor((current - 1) / 4));
    this.restoreGameState();
    this.renderTimeline(true);

    if(current % 4 === 0) {
      const completedChapter = Math.floor((current - 1) / 4);
      const nextChapterIndex = next <= total ? Math.floor((next - 1) / 4) : null;
      setTimeout(() => this.showChapterTimeline(completedChapter, nextChapterIndex), 1200);
      return;
    }

    if(current >= total) {
      setTimeout(() => this.startDialogue(["Linha do tempo completa. O Relatório Final está disponível no menu superior."], "normal"), 1000);
    } else {
      setTimeout(() => this.startDialogue(["A pista foi anexada. A próxima ficha da gaveta foi liberada."], "normal"), 1000);
    }
  }
};

GameLogic.bindDrawerEvents = function() {
  const prev = document.getElementById('prevDrawerBtn');
  const next = document.getElementById('nextDrawerBtn');
  if(prev) prev.onclick = () => this.changeDrawer(-1);
  if(next) next.onclick = () => this.changeDrawer(1);
};

GameLogic.closeTopLayer = function() {
  const finalLetter = document.getElementById('finalLetterOverlay');
  if(finalLetter && typeof this.closeFinalLetter === 'function') {
    this.closeFinalLetter();
    return true;
  }

  const finalThanks = document.getElementById('finalThanksScreen');
  if(finalThanks && this.user?.isAdmin && typeof this.dismissFinalThanks === 'function') {
    this.dismissFinalThanks();
    return true;
  }

  const decisionLayer = document.querySelector('.profile-decision-layer');
  if(decisionLayer) {
    decisionLayer.remove();
    return true;
  }

  const phaseIntro = document.getElementById('phaseIntroOverlay');
  if(phaseIntro) {
    phaseIntro.remove();
    return true;
  }

  if(this.closeChapterTimeline()) return true;

  const investigation = document.getElementById('investigationModal');
  if(investigation) {
    investigation.remove();
    if(this.board) this.board.classList.remove('blurred');
    return true;
  }

  if(this.notebookOverlay && this.notebookOverlay.classList.contains('active')) {
    this.closeNotebook();
    return true;
  }

  if(this.invOverlay && this.invOverlay.classList.contains('active')) {
    this.closeInventoryPanel();
    return true;
  }

  const menu = document.getElementById('fullMenu');
  if(menu && menu.classList.contains('active')) {
    menu.classList.remove('active');
    return true;
  }

  const modalOverlay = document.getElementById('modalOverlay');
  if(modalOverlay && modalOverlay.classList.contains('active')) {
    modalOverlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    return true;
  }

  return false;
};

GameLogic.bindKeyboardShortcuts = function() {
  if(this.keyboardShortcutsBound) return;
  this.keyboardShortcutsBound = true;

  document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape') {
      event.preventDefault();

      if(this.isDialogueActive) {
        this.advanceDialogue();
        return;
      }

      this.closeTopLayer();
      return;
    }

    if(document.getElementById('finalLetterOverlay') || document.getElementById('finalThanksScreen')) return;

    const tag = event.target?.tagName?.toLowerCase();
    if(['input', 'textarea', 'select'].includes(tag)) return;

    if(event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      this.changeDrawer(1);
      return;
    }

    if(event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      this.changeDrawer(-1);
      return;
    }

    if(/^[1-9]$/.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const phase = this.getPhaseByShortcut(Number(event.key));
      if(!phase || this.isPhaseShortcutBlocked()) return;

      event.preventDefault();
      if((this.progress?.unlockedPhases || [1]).includes(phase.phaseNum)) {
        this.clickPhase(phase.phaseNum);
      } else {
        this.checkLocked(phase.title || `Ficha ${event.key}`);
      }
      return;
    }

    const key = event.key.toLowerCase();
    if(key === 'i') {
      event.preventDefault();
      if(this.invOverlay) {
        const willOpen = !this.invOverlay.classList.contains('active');
        this.setFullscreenMode(this.invOverlay, false, this.inventoryExpandBtn, 'Inventário');
        this.invOverlay.classList.toggle('active', willOpen);
      }
    } else if(key === 'm') {
      event.preventDefault();
      const menu = document.getElementById('fullMenu');
      if(menu) menu.classList.toggle('active');
    } else if(key === 'p') {
      event.preventDefault();
      this.openProfileModal(!!this.user);
    }
  });
};

const originalBindEvents = GameLogic.bindEvents.bind(GameLogic);
GameLogic.bindEvents = function() {
  originalBindEvents();
  this.bindDrawerEvents();
  this.bindKeyboardShortcuts();
};

/* =========================================================
   CAPITULOS COM 6 FICHAS E MINIJOGOS EXPANDIDOS
   ========================================================= */
GameLogic.getChapters = function() {
  const chapterI = {
    number: "I",
    title: "Abrindo o Arquivo",
    label: "Capitulo I - A Brecha",
    timeline: [
      { date: "1927", text: "Uma brecha legal permite o alistamento de Celina Guimaraes." },
      { date: "1932", text: "O Codigo Eleitoral reconhece o voto feminino." },
      { date: "1933", text: "Mulheres chegam aos cartorios e registros eleitorais." },
      { date: "Maio 1933", text: "Muzambinho participa da eleicao para a Constituinte." },
      { date: "Debate publico", text: "Jornais e conversas expõem argumentos contra e a favor." },
      { date: "Arquivo aberto", text: "A primeira gaveta revela o caminho nacional ate o municipio." }
    ],
    phases: [
      {
        tab: "01. CARTA",
        title: "O Precedente Potiguar",
        activeText: "Leia a carta e encontre a brecha juridica usada em 1927.",
        lockedText: "Abra a primeira ficha para iniciar o arquivo.",
        mode: "quiz",
        t: "O Precedente Potiguar (1927)",
        c: "<b>DOCUMENTO:</b> Carta de Celina Guimaraes Viana ao Senado Federal.<br><br><i>'Invoquei o artigo 17 da Lei Eleitoral do Rio Grande do Norte, que cita apenas cidadaos, sem distincao de sexo.'</i><br><br>Este ato provou que a lei nao proibia o voto feminino; ela apenas o omitia por conveniencia.",
        q: "Qual foi a estrategia juridica usada por Celina Guimaraes para garantir seu alistamento em 1927?",
        options: ["Criar uma nova Constituicao Estadual", "Interpretar a neutralidade de genero na lei vigente", "Fazer um abaixo-assinado nacional", "Receber autorizacao direta do presidente"],
        correctIndex: 1,
        hint: "Repare que a forca do argumento estava no texto da lei: ela falava em cidadaos, sem separar homens e mulheres.",
        curiosity: "Celina Guimaraes Viana e lembrada como uma das primeiras eleitoras do Brasil, no Rio Grande do Norte."
      },
      {
        tab: "02. ORDEM",
        title: "Linha da Conquista",
        activeText: "Arraste os acontecimentos para a ordem cronologica.",
        lockedText: "Conclua a carta para ordenar os marcos.",
        mode: "chronology",
        t: "Linha da Conquista (1927-1933)",
        c: "<b>DESPACHO:</b> Os documentos chegaram fora de ordem. Reconstrua a sequencia para entender como a conquista chegou ate Muzambinho.",
        q: "Arraste cada marco para o 1º, 2º e 3º lugar.",
        events: [
          { id: "celina", label: "Celina Guimaraes se alista no Rio Grande do Norte", year: "1927" },
          { id: "codigo", label: "O Codigo Eleitoral reconhece o voto feminino", year: "1932" },
          { id: "constituinte", label: "Mulheres votam para a Constituinte, incluindo Muzambinho", year: "1933" }
        ],
        correctOrder: ["celina", "codigo", "constituinte"],
        hint: "Comece pelo acontecimento mais antigo: primeiro vem a brecha de 1927, depois a lei nacional.",
        curiosity: "A eleicao para a Assembleia Constituinte de 1933 foi uma das primeiras grandes experiencias de voto feminino no pais."
      },
      {
        tab: "03. GRIFO",
        title: "Missao no Jornal",
        activeText: "Grife o trecho exato que mostra o argumento contrario.",
        lockedText: "Ordene a linha para abrir o jornal.",
        mode: "textHighlight",
        t: "Jornal de Epoca",
        c: "<b>RECORTE:</b> O texto mistura noticia, receio e opiniao. Use o marca-texto apenas no trecho que responde a missao.",
        q: "Missao: encontre o argumento usado por opositores para negar o voto feminino.",
        highlightText: "Alguns vereadores diziam que a politica tiraria as mulheres do lar, enquanto professoras defendiam que votar tambem era proteger a familia e a cidade.",
        answerWords: ["politica", "tiraria", "as", "mulheres", "do", "lar"],
        hint: "Procure a frase que apresenta medo ou proibicao, nao a frase que defende o direito.",
        curiosity: "Muitos argumentos contra o voto feminino tentavam prender a mulher ao espaco domestico."
      },
      {
        tab: "04. CRIVO",
        title: "Fato ou Opiniao",
        activeText: "Classifique afirmacoes antes de anexar ao arquivo.",
        lockedText: "Grife o jornal para abrir o crivo.",
        mode: "factOpinion",
        t: "Crivo Historico",
        c: "<b>CARIMBO DE ANALISE:</b> Nem tudo que aparece em um arquivo tem o mesmo peso. Separe fatos verificaveis de leituras opinativas.",
        q: "Classifique cada frase como fato ou opiniao.",
        statements: [
          { id: "lei", text: "O Codigo Eleitoral de 1932 reconheceu o voto feminino.", answer: "fato" },
          { id: "maior", text: "Esse foi o momento mais bonito da politica brasileira.", answer: "opiniao" },
          { id: "muz", text: "Muzambinho participou da eleicao para a Constituinte em 1933.", answer: "fato" }
        ],
        hint: "Fato pode ser conferido por data, lei, ata ou registro. Opiniao depende de julgamento pessoal.",
        curiosity: "Arquivos historicos guardam fatos e impressoes; o trabalho da investigacao e separar uma coisa da outra."
      },
      {
        tab: "05. ANO",
        title: "Ponteiro do Tempo",
        activeText: "Ajuste a barra para chegar ao ano correto.",
        lockedText: "Resolva o crivo para abrir o ponteiro.",
        mode: "yearSlider",
        t: "Ponteiro do Tempo",
        c: "<b>MEDIDOR:</b> O arquivo pede precisao. Solte a barra no ano em que o Codigo Eleitoral reconheceu o voto feminino no Brasil.",
        q: "Em que ano o voto feminino foi reconhecido pelo Codigo Eleitoral brasileiro?",
        min: 1900,
        max: 1950,
        target: 1932,
        tolerance: 1,
        hint: "A data fica logo antes da eleicao de 1933.",
        curiosity: "O reconhecimento de 1932 abriu a porta para a participacao feminina na Constituinte de 1933."
      },
      {
        tab: "06. VOZES",
        title: "Vozes do Debate",
        activeText: "Ligue cada fala ao grupo mais provavel.",
        lockedText: "Acerte o ano para abrir as vozes.",
        mode: "quoteMatch",
        t: "Vozes do Debate Publico",
        c: "<b>FICHARIO:</b> As falas abaixo sao formulacoes historicas inspiradas em debates da epoca. Use-as como pistas de posicao politica.",
        q: "Associe cada fala a quem provavelmente defenderia aquela ideia.",
        people: [
          { id: "sufragista", name: "Sufragista" },
          { id: "opositor", name: "Opositor" },
          { id: "eleitora", name: "Eleitora local" }
        ],
        quotes: [
          { id: "direito", text: "Votar e participar da vida publica tambem e dever civico da mulher.", answer: "sufragista" },
          { id: "lar", text: "A politica afastaria a mulher de suas obrigacoes no lar.", answer: "opositor" },
          { id: "registro", text: "Se a lei me permite, quero meu nome registrado como eleitora.", answer: "eleitora" }
        ],
        hint: "A fala contraria costuma defender exclusao; a fala sufragista defende cidadania.",
        curiosity: "O debate sobre sufragio feminino passava tanto por leis quanto por costumes sociais."
      }
    ]
  };

  const chapterII = {
    number: "II",
    title: "Muzambinho em Movimento",
    label: "Capitulo II - A Cidade",
    timeline: [
      { date: "Inicio 1933", text: "A noticia do novo direito circula pela cidade." },
      { date: "Abril 1933", text: "Documentos de alistamento aparecem nas secoes eleitorais." },
      { date: "Maio 1933", text: "Eleitoras comparecem ao processo eleitoral." },
      { date: "Atas", text: "Registros locais preservam presenca e assinatura." },
      { date: "Jornais", text: "Manchetes e boatos disputam a memoria do acontecimento." },
      { date: "Cidade", text: "O direito nacional ganha forma em Muzambinho." }
    ],
    phases: [
      {
        tab: "07. CABINE",
        title: "Cabine de Votacao",
        activeText: "Analise o perfil e escolha se pode votar.",
        lockedText: "Complete o Capitulo I para abrir a cidade.",
        mode: "votingBooth",
        t: "Mesa do Mesario",
        c: "<b>PERFIL:</b> Maria, 25 anos, alfabetizada, solteira, com renda propria e documento de alistamento apresentado ao mesario em 1933.",
        q: "Pelas regras do periodo, qual acao correta o mesario deveria tomar?",
        choices: [
          { id: "carimbar", text: "Carimbar a cedula e permitir o voto", correct: true },
          { id: "impedir_marido", text: "Impedir por falta de autorizacao do marido", correct: false },
          { id: "impedir_idade", text: "Impedir por causa da idade", correct: false }
        ],
        hint: "Observe estado civil, renda e documento. O impedimento do marido nao se aplica a uma mulher solteira.",
        curiosity: "As regras iniciais ainda eram restritivas, mas algumas mulheres conseguiam cumprir as exigencias legais."
      },
      {
        tab: "08. LACUNAS",
        title: "Restaurar Ata",
        activeText: "Arraste palavras para recompor o texto historico.",
        lockedText: "Resolva a cabine para abrir a ata.",
        mode: "restoreText",
        t: "Ata Danificada",
        c: "<b>ATA:</b> A umidade apagou palavras essenciais. Restaure o sentido antes de anexar o documento.",
        q: "Complete as lacunas com as palavras corretas.",
        template: ["Em 1933, o ", "voto", " feminino aparece nos registros da ", "eleicao", " constituinte em ", "Muzambinho", "."],
        blanks: [
          { id: "b1", answer: "voto" },
          { id: "b2", answer: "eleicao" },
          { id: "b3", answer: "Muzambinho" }
        ],
        words: ["Muzambinho", "voto", "teatro", "eleicao", "cafe"],
        hint: "As palavras precisam reconstruir sujeito, acontecimento e lugar.",
        curiosity: "Atas e listas eleitorais sao pistas valiosas porque registram o acontecimento em papel oficial."
      },
      {
        tab: "09. MANCHETE",
        title: "Manchete Embaralhada",
        activeText: "Reordene as palavras da manchete.",
        lockedText: "Restaure a ata para abrir a manchete.",
        mode: "headlineOrder",
        t: "Manchete Embaralhada",
        c: "<b>JORNAL:</b> A tipografia se espalhou pela mesa. Monte a frase na ordem correta.",
        q: "Clique nas palavras para formar a manchete.",
        words: ["MULHERES", "VOTAM", "EM", "MUZAMBINHO", "NA", "CONSTITUINTE"],
        correctOrder: ["MULHERES", "VOTAM", "EM", "MUZAMBINHO", "NA", "CONSTITUINTE"],
        hint: "A frase comeca com quem praticou a acao e termina com o contexto da eleicao.",
        curiosity: "Manchetes condensavam acontecimentos complexos em poucas palavras de grande impacto."
      },
      {
        tab: "10. FIOS",
        title: "Mural de Fios",
        activeText: "Ligue leis, pessoas e impactos.",
        lockedText: "Monte a manchete para abrir o mural.",
        mode: "wireBoard",
        t: "Mural de Fios",
        c: "<b>MURAL:</b> A investigacao precisa ligar as pistas certas, como fios em um quadro de arquivo.",
        q: "Associe cada ponto ao impacto correto.",
        pairs: [
          { id: "bertha", clue: "Bertha Lutz", options: ["Mobilizacao nacional", "Ata municipal", "Urna lacrada"], answer: "Mobilizacao nacional" },
          { id: "codigo", clue: "Codigo Eleitoral", options: ["Base legal do voto", "Carta pessoal", "Boato de rua"], answer: "Base legal do voto" },
          { id: "ata", clue: "Ata local", options: ["Prova territorial", "Discurso de opositor", "Lei estrangeira"], answer: "Prova territorial" }
        ],
        hint: "Pense em escala: pessoa mobiliza, lei autoriza, ata comprova no territorio.",
        curiosity: "Um bom dossie liga o movimento nacional aos rastros locais."
      },
      {
        tab: "11. ATA",
        title: "Trecho da Ata",
        activeText: "Grife o detalhe que comprova participacao.",
        lockedText: "Ligue os fios para abrir a ata.",
        mode: "textHighlight",
        t: "Trecho da Ata Eleitoral",
        c: "<b>ATA:</b> O trecho tem muitos detalhes administrativos. Grife apenas o que comprova a participacao civica feminina.",
        q: "Missao: encontre o detalhe que prova a presenca de eleitoras.",
        highlightText: "Na lista de votantes constam nomes femininos registrados e carimbados pela mesa eleitoral, junto aos demais eleitores.",
        answerWords: ["nomes", "femininos", "registrados", "e", "carimbados"],
        hint: "A prova mais forte combina nome, registro e carimbo.",
        curiosity: "Um carimbo pode parecer pequeno, mas em arquivo ele ajuda a transformar memoria em prova."
      },
      {
        tab: "12. APOIO",
        title: "Termometro do Discurso",
        activeText: "Meça se a fala e contra, moderada ou favoravel.",
        lockedText: "Grife a ata para abrir o termometro.",
        mode: "supportMeter",
        t: "Termometro do Discurso",
        c: "<b>BALAO DE FALA:</b> 'Se as mulheres ja sustentam escolas, familias e associacoes, tambem podem sustentar uma opiniao politica nas urnas.'",
        q: "Indique o grau de apoio dessa fala ao voto feminino.",
        minLabel: "Contra",
        midLabel: "Moderada",
        maxLabel: "A favor",
        correctRange: [70, 100],
        hint: "A fala defende diretamente a capacidade politica das mulheres.",
        curiosity: "Nem todo apoio vinha com linguagem radical; muitas defesas usavam argumentos de responsabilidade civica."
      }
    ]
  };

  const chapterIII = {
    number: "III",
    title: "Memoria Preservada",
    label: "Capitulo III - O Legado",
    timeline: [
      { date: "1933", text: "Votar deixa de ser rumor e vira registro." },
      { date: "Depois de maio", text: "Atas ajudam a provar presenca e participacao." },
      { date: "Decadas seguintes", text: "Outros direitos passam a compor a cidadania feminina." },
      { date: "Memoria local", text: "O arquivo liga conquista nacional e experiencia municipal." },
      { date: "Hoje", text: "A investigacao transforma registro em memoria publica." },
      { date: "Dossie final", text: "A linha do tempo fica completa." }
    ],
    phases: [
      {
        tab: "13. DIREITOS",
        title: "Escada dos Direitos",
        activeText: "Empilhe conquistas na ordem historica.",
        lockedText: "Complete o Capitulo II para abrir o legado.",
        mode: "rightsStack",
        t: "Escada dos Direitos",
        c: "<b>ESCADA:</b> Direitos nao chegaram todos ao mesmo tempo. Organize os degraus da cidadania.",
        q: "Arraste ou clique nos direitos do mais antigo para o mais recente.",
        rights: [
          { id: "votar", label: "Votar em eleicoes nacionais", year: "1932" },
          { id: "eleita", label: "Ser eleita e ocupar cargos politicos", year: "1930s" },
          { id: "trabalho", label: "Trabalhar sem autorizacao do marido", year: "1962" },
          { id: "credito", label: "Ter maior autonomia financeira e civil", year: "Decadas seguintes" }
        ],
        correctOrder: ["votar", "eleita", "trabalho", "credito"],
        hint: "Comece pelo direito ligado diretamente ao Codigo Eleitoral.",
        curiosity: "O voto foi um marco, mas nao resolveu sozinho todas as desigualdades civis."
      },
      {
        tab: "14. ELOS",
        title: "Elo das Pioneiras",
        activeText: "Associe pessoa, documento e impacto.",
        lockedText: "Suba a escada para abrir os elos.",
        mode: "connections",
        t: "Elo das Pioneiras",
        c: "<b>FICHARIO:</b> Cada pioneira abre uma trilha de leitura: lei, registro, memoria e permanencia.",
        q: "Ligue cada pista ao impacto correto.",
        pairs: [
          { id: "celina", clue: "Celina Guimaraes", options: ["Mostrou a brecha legal", "Escreveu a ata de Muzambinho", "Organizou o museu"], answer: "Mostrou a brecha legal" },
          { id: "codigo", clue: "Codigo Eleitoral", options: ["Transformou brecha em direito reconhecido", "Criou a imprensa local", "Cancelou eleicoes"], answer: "Transformou brecha em direito reconhecido" },
          { id: "arquivo", clue: "Ata local", options: ["Prende a memoria ao territorio", "Escolhe a roupa das eleitoras", "Define a praca"], answer: "Prende a memoria ao territorio" }
        ],
        hint: "A pista local deve terminar no territorio; a lei deve terminar no direito reconhecido.",
        curiosity: "Memoria historica nasce quando o documento nacional encontra o registro local."
      },
      {
        tab: "15. SELO",
        title: "Selo Final",
        activeText: "Escolha o selo que resume o documento.",
        lockedText: "Ligue os elos para abrir o selo.",
        mode: "quiz",
        t: "Selo Final do Arquivo",
        c: "<b>CARIMBO:</b> Antes do encerramento, o dossie precisa receber o selo correto.",
        q: "Qual selo resume melhor o sentido historico do arquivo?",
        options: ["Curiosidade sem prova", "Memoria civica recuperada", "Documento irrelevante", "Registro apenas decorativo"],
        correctIndex: 1,
        hint: "O arquivo nao e enfeite: ele recupera uma memoria civica comprovavel.",
        curiosity: "Preservar documentos ajuda uma cidade a reconhecer quem participou da sua historia."
      },
      {
        tab: "16. ROTAS",
        title: "Rotas da Memoria",
        activeText: "Ordene como um fato vira memoria publica.",
        lockedText: "Escolha o selo para abrir as rotas.",
        mode: "chronology",
        t: "Rotas da Memoria",
        c: "<b>ROTA:</b> O acontecimento vira memoria quando passa por registros, leitura e compartilhamento.",
        q: "Arraste as etapas para a ordem correta.",
        events: [
          { id: "acontece", label: "O acontecimento ocorre", year: "1" },
          { id: "registra", label: "O documento registra a presenca", year: "2" },
          { id: "interpreta", label: "A pesquisa interpreta a pista", year: "3" },
          { id: "compartilha", label: "A memoria e compartilhada", year: "4" }
        ],
        correctOrder: ["acontece", "registra", "interpreta", "compartilha"],
        hint: "Primeiro o fato acontece; depois ele precisa ser registrado.",
        curiosity: "Sem leitura e preservacao, muitos registros ficam silenciosos por decadas."
      },
      {
        tab: "17. TEXTO",
        title: "Conclusao Rasurada",
        activeText: "Restaure a conclusao do dossie.",
        lockedText: "Ordene as rotas para abrir a conclusao.",
        mode: "restoreText",
        t: "Conclusao Rasurada",
        c: "<b>RELATORIO:</b> A ultima pagina perdeu palavras-chave. Recoloque-as antes do parecer final.",
        q: "Complete a conclusao com as expressoes corretas.",
        template: ["O voto feminino em ", "Muzambinho", " mostra que a cidadania tambem se construiu por ", "registros", " locais e por ", "memoria", " preservada."],
        blanks: [
          { id: "b1", answer: "Muzambinho" },
          { id: "b2", answer: "registros" },
          { id: "b3", answer: "memoria" }
        ],
        words: ["memoria", "Muzambinho", "moda", "registros", "boato"],
        hint: "A conclusao precisa juntar lugar, prova e lembranca publica.",
        curiosity: "Uma cidade tambem guarda historia nos pequenos papeis que sobreviveram."
      },
      {
        tab: "18. SINTESE",
        title: "Sintese da Memoria",
        activeText: "Grife a frase que fecha o argumento.",
        lockedText: "Restaure a conclusao para abrir a sintese.",
        mode: "textHighlight",
        t: "Sintese da Memoria",
        c: "<b>DOSSIE:</b> A ultima decisao e escolher a frase sustentada por todo o arquivo.",
        q: "Missao: grife a conclusao que pode entrar no relatorio final.",
        highlightText: "A conquista nacional abriu caminho para a participacao local, e Muzambinho integra a historia concreta do voto feminino em 1933.",
        answerWords: ["Muzambinho", "integra", "a", "historia", "concreta", "do", "voto", "feminino", "em", "1933"],
        hint: "A frase correta liga o municipio ao acontecimento nacional, sem exagero nem boato.",
        curiosity: "A memoria publica fica mais forte quando a narrativa nasce de pistas verificadas."
      }
    ]
  };

  return [chapterI, chapterII, chapterIII];
};

GameLogic.getChapterStartPhase = function(chapterIndex) {
  return this.getChapters().slice(0, chapterIndex).reduce((sum, chapter) => sum + chapter.phases.length, 1);
};

GameLogic.getPhaseList = function() {
  return this.getChapters().flatMap((chapter, chapterIndex) => {
    const start = this.getChapterStartPhase(chapterIndex);
    return chapter.phases.map((phase, phaseIndex) => ({
      ...phase,
      phaseNum: start + phaseIndex,
      chapterIndex,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title
    }));
  });
};

GameLogic.getActiveChapterIndex = function() {
  const phases = this.getPhaseList();
  const highest = Math.max(...(this.progress?.unlockedPhases || [1]).filter(num => num <= phases.length));
  const phase = phases.find(item => item.phaseNum === highest) || phases[0];
  return phase ? phase.chapterIndex : 0;
};

GameLogic.isChapterAvailable = function(chapterIndex) {
  const chapters = this.getChapters();
  if(chapterIndex <= 0) return true;
  if(chapterIndex >= chapters.length) return false;
  const firstPhase = this.getChapterStartPhase(chapterIndex);
  return (this.progress?.unlockedPhases || [1]).includes(firstPhase);
};

GameLogic.renderDrawer = function() {
  const drawer = document.querySelector('.drawer-inside');
  if(!drawer) return;

  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  const chapters = this.getChapters();
  const chapter = chapters[this.currentChapterIndex];
  const phases = this.getPhaseList().filter(phase => phase.chapterIndex === this.currentChapterIndex);
  const unlocked = this.progress?.unlockedPhases || [1];
  const tabClasses = ['', 'tab-center', 'tab-right'];

  drawer.innerHTML = phases.map((phase, index) => {
    const isUnlocked = unlocked.includes(phase.phaseNum);
    const tabClass = tabClasses[index % 3];
    return `
      <button class="file-folder ${isUnlocked ? 'folder-active' : 'folder-locked'}" id="phase${phase.phaseNum}" type="button" data-locked="${!isUnlocked}" onclick="${isUnlocked ? `GameLogic.clickPhase(${phase.phaseNum})` : `GameLogic.checkLocked('${phase.title.replace(/'/g, "\\'")}')`}">
        <div class="folder-tab ${tabClass}">${phase.tab}</div>
        <div class="folder-paper">
          <div class="paper-clip"></div>
          <h4>${isUnlocked ? phase.title : 'Arquivo Selado'}</h4>
          <p>${isUnlocked ? phase.activeText : phase.lockedText}</p>
          <span class="confidential-stamp ${isUnlocked ? '' : 'locked'}">${isUnlocked ? 'LIVRE' : 'SIGILO'}</span>
        </div>
      </button>
    `;
  }).join('');

  const label = document.getElementById('drawerLabel');
  if(label) {
    label.innerHTML = `
      <span>Capitulo ${chapter.number}</span>
      <strong>${chapter.title}</strong>
      <small>Gaveta ${this.currentChapterIndex + 1} de ${chapters.length}</small>
    `;
  }

  const prev = document.getElementById('prevDrawerBtn');
  const next = document.getElementById('nextDrawerBtn');
  if(prev) {
    prev.disabled = this.currentChapterIndex === 0;
    prev.classList.toggle('is-locked', false);
  }
  if(next) {
    const isLast = this.currentChapterIndex >= chapters.length - 1;
    const nextIsOpen = this.isChapterAvailable(this.currentChapterIndex + 1);
    next.disabled = isLast;
    next.classList.toggle('is-locked', !isLast && !nextIsOpen);
    next.dataset.locked = String(!isLast && !nextIsOpen);
    next.title = !isLast && !nextIsOpen ? 'Conclua este capitulo antes de abrir a proxima gaveta.' : 'Avancar para a proxima gaveta';
  }

  let kicker = document.querySelector('.chapter-kicker');
  if(!kicker) {
    kicker = document.createElement('div');
    kicker.className = 'chapter-kicker';
    const cabinet = document.querySelector('.steel-cabinet');
    if(cabinet) cabinet.appendChild(kicker);
  }
  kicker.innerHTML = `<span>Capitulo ${chapter.number}</span><strong>${chapter.title}</strong>`;
};

GameLogic.renderTimeline = function(animate = false) {
  const timeline = document.getElementById('timelineStrip');
  if(!timeline || !this.progress) return;
  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  const chapter = this.getChapters()[this.currentChapterIndex];
  const phases = this.getPhaseList().filter(phase => phase.chapterIndex === this.currentChapterIndex);
  timeline.innerHTML = `<div class="timeline-track"></div>${chapter.timeline.map((entry, index) => {
    const phaseNum = phases[index]?.phaseNum || this.getChapterStartPhase(this.currentChapterIndex) + index;
    const completed = this.progress.unlockedPhases.includes(phaseNum + 1);
    const active = this.progress.unlockedPhases.includes(phaseNum) && !completed;
    return `<div class="timeline-item ${completed ? 'completed' : ''} ${active ? 'active' : ''}" data-phase="${phaseNum}"><span>${entry.date}</span><small>${entry.text}</small></div>`;
  }).join('')}`;
  if(animate) {
    timeline.classList.remove('timeline-flash');
    void timeline.offsetWidth;
    timeline.classList.add('timeline-flash');
  }
};

GameLogic.unlockNextPhase = function(current, options = {}) {
  const phases = this.getPhaseList();
  const total = phases.length;
  const next = current + 1;
  const currentPhase = phases.find(item => item.phaseNum === current);
  const nextPhase = phases.find(item => item.phaseNum === next);

  if (!this.progress.unlockedPhases.includes(next)) {
    this.progress.unlockedPhases.push(next);
    this.saveGameProgress();
  }

  if(currentPhase) this.currentChapterIndex = currentPhase.chapterIndex;
  this.restoreGameState();
  this.renderTimeline(true);

  const chapterPhases = phases.filter(item => item.chapterIndex === currentPhase?.chapterIndex);
  const lastInChapter = chapterPhases[chapterPhases.length - 1]?.phaseNum;

  if(current === lastInChapter) {
    const nextChapterIndex = nextPhase ? nextPhase.chapterIndex : null;
    setTimeout(() => this.showChapterTimeline(currentPhase.chapterIndex, nextChapterIndex), 900);
    return;
  }

  if(current >= total) {
    setTimeout(() => this.startDialogue(["Linha do tempo completa. O Relatorio Final esta disponivel no menu superior."], "normal"), 900);
  } else {
    setTimeout(() => this.startDialogue(["A pista foi anexada. A proxima ficha da gaveta foi liberada."], "normal"), 900);
  }
};

GameLogic.showWrongAnswerHelp = function(data) {
  const hint = data.wrongFeedback || data.hint || "Releia o documento com calma. A resposta costuma estar em uma data, palavra-chave ou detalhe do registro.";
  const lines = [hint];
  if(data.curiosity) lines.push(`Curiosidade: ${data.curiosity}`);
  const npcOverlay = document.getElementById('npcOverlay');
  if(npcOverlay) npcOverlay.style.zIndex = '99999';
  this.startDialogue(lines, "wrong_answer");
};

EvidenceSystem.tokenizeHighlightText = function(data) {
  const answerQueue = [...(data.answerWords || [])].map(word => this.normalizeToken(word));
  return String(data.highlightText || '').split(/(\s+)/).map((part, index) => {
    const normalized = this.normalizeToken(part);
    let answer = false;
    if(normalized && normalized === answerQueue[0]) {
      answer = true;
      answerQueue.shift();
    }
    return { id: `w${index}`, text: part, answer, selectable: Boolean(normalized) };
  });
};

EvidenceSystem.normalizeToken = function(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, '').toLowerCase();
};

EvidenceSystem.getMeaningfulHighlightWords = function(words = []) {
  const ignored = new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
    'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas',
    'que', 'se', 'por', 'para', 'com', 'ao', 'aos', 'sua', 'seu', 'suas', 'seus'
  ]);
  return words
    .map(word => this.normalizeToken(word))
    .filter(word => word && !ignored.has(word));
};

EvidenceSystem.gradeTextHighlight = function(overlay, data) {
  const selectedButtons = Array.from(overlay.querySelectorAll('.mark-token.selected'));
  const selectedWords = this.getMeaningfulHighlightWords(selectedButtons.map(el => el.innerText));
  const requiredWords = this.getMeaningfulHighlightWords(data.answerWords || []);
  const allowedWords = new Set(requiredWords);
  const missingRequired = requiredWords.filter(word => !selectedWords.includes(word));
  const extraMeaningful = selectedWords.filter(word => !allowedWords.has(word));
  const selectedAnswer = selectedButtons.map(el => el.innerText).join(' ');

  return {
    isCorrect: requiredWords.length > 0 && missingRequired.length === 0 && extraMeaningful.length <= 2,
    selectedAnswer: selectedAnswer || 'Nenhum trecho grifado'
  };
};

EvidenceSystem.toggleFullscreen = function(button) {
  const overlay = button?.closest('.investigation-overlay');
  if(!overlay) return;
  const expanded = !overlay.classList.contains('fullscreen-mode');
  overlay.classList.toggle('fullscreen-mode', expanded);
  button.setAttribute('aria-pressed', expanded ? 'true' : 'false');
  button.setAttribute('aria-label', expanded ? 'Reduzir Pergunta' : 'Expandir Pergunta');
  button.setAttribute('title', expanded ? 'Reduzir Pergunta' : 'Expandir Pergunta');
  button.innerHTML = expanded ? '&#x2921;' : '&#x26F6;';
};

EvidenceSystem.spawnEvidence = function(title, text, phaseData) {
  let existing = document.getElementById('investigationModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'investigationModal';
  overlay.className = 'investigation-overlay';
  const activityHTML = this.renderActivity(phaseData);

  overlay.innerHTML = `
    <div class="investigation-dossier" id="dossierContainer">
      <div class="dossier-clip"></div>
      <div class="dossier-page page-left" style="background:#ece5d5; border-right:1px solid rgba(0,0,0,0.1);">
        <div class="dossier-paper-pad">
          <div class="form-tag">DOCUMENTO APREENDIDO</div>
          <h2 class="evidence-title">${title}</h2>
          <div class="evidence-text">${text}</div>
        </div>
      </div>
      <div class="dossier-page page-right" style="background:#e6dfcd;">
        <button class="fullscreen-toggle investigation-fullscreen-toggle" type="button" title="Expandir Pergunta" aria-label="Expandir Pergunta" aria-pressed="false" onclick="EvidenceSystem.toggleFullscreen(this)">&#x26F6;</button>
        <button class="close-investigation" title="Fechar Pasta" onclick="this.closest('.investigation-overlay').remove()">✕</button>
        <div class="form-header">
          <div class="form-tag">LUZES DE MAIO</div>
          <h2 class="form-title">Questionario de Analise</h2>
        </div>
        <p class="quiz-question">${phaseData.q}</p>
        <div class="activity-area">${activityHTML}</div>
        <div class="quiz-feedback"></div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  this.bindActivity(overlay, title, text, phaseData);
};

EvidenceSystem.renderActivity = function(data) {
  const submit = (label) => `<button class="btn-primary activity-submit" type="button" data-submit-activity>${label}</button>`;

  if(data.mode === 'chronology' || data.mode === 'rightsStack') {
    const items = data.events || data.rights || [];
    const orderClass = data.mode === 'rightsStack' ? 'rights-lane' : 'chronology-lane';
    return `
      <div class="drop-lane ${orderClass}">
        ${items.map((_, index) => `<div class="drop-slot" data-slot-index="${index}"><span>${index + 1}</span><em>Solte aqui</em></div>`).join('')}
      </div>
      <div class="activity-bank">
        ${items.map(item => `<button class="activity-card drag-card" type="button" draggable="true" data-order-id="${item.id}" data-order-label="${this.escapeHTML(item.label)}">${data.mode === 'rightsStack' ? '' : `<strong>${this.escapeHTML(item.year || '')}</strong>`}${this.escapeHTML(item.label)}</button>`).join('')}
      </div>
      ${submit(data.mode === 'rightsStack' ? 'Carimbar escada' : 'Carimbar ordem')}`;
  }

  if(data.mode === 'textHighlight') {
    const tokens = this.tokenizeHighlightText(data);
    return `
      <div class="mission-card">${this.escapeHTML(data.q)}</div>
      <div class="mark-text" data-mark-text>
        ${tokens.map(token => token.selectable
          ? `<button class="mark-token" type="button" data-token-id="${token.id}" data-answer="${token.answer}">${this.escapeHTML(token.text)}</button>`
          : `<span>${this.escapeHTML(token.text)}</span>`).join('')}
      </div>
      ${submit('Carimbar grifo')}`;
  }

  if(data.mode === 'yearSlider') {
    return `
      <div class="year-slider-wrap">
        <div class="year-readout"><span data-year-output>${Math.round((data.min + data.max) / 2)}</span></div>
        <input class="year-slider" type="range" min="${data.min}" max="${data.max}" value="${Math.round((data.min + data.max) / 2)}" data-year-slider>
        <div class="year-scale"><span>${data.min}</span><span>${data.max}</span></div>
      </div>
      ${submit('Soltar ponteiro')}`;
  }

  if(data.mode === 'quoteMatch') {
    return `
      <div class="quote-people">
        ${data.people.map(person => `<div class="person-card"><span>${this.escapeHTML(person.name.charAt(0))}</span><strong>${this.escapeHTML(person.name)}</strong></div>`).join('')}
      </div>
      ${data.quotes.map(quote => `
        <div class="activity-card" data-quote-id="${quote.id}">
          <p>${this.escapeHTML(quote.text)}</p>
          <div class="choice-row">
            ${data.people.map(person => `<button class="mini-action-btn" type="button" data-value="${person.id}">${this.escapeHTML(person.name)}</button>`).join('')}
          </div>
        </div>`).join('')}
      ${submit('Carimbar vozes')}`;
  }

  if(data.mode === 'restoreText') {
    let blankIndex = 0;
    const textHTML = data.template.map(part => {
      const blank = data.blanks[blankIndex];
      if(blank && part === blank.answer) {
        blankIndex += 1;
        return `<button class="blank-slot" type="button" data-blank-id="${blank.id}" data-answer="${this.escapeHTML(blank.answer)}">_____</button>`;
      }
      return `<span>${this.escapeHTML(part)}</span>`;
    }).join('');
    return `
      <div class="restore-text">${textHTML}</div>
      <div class="word-bank">
        ${data.words.map(word => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}">${this.escapeHTML(word)}</button>`).join('')}
      </div>
      ${submit('Carimbar texto')}`;
  }

  if(data.mode === 'votingBooth') {
    return `
      <div class="booth-card">
        ${data.choices.map(choice => `<button class="activity-card" type="button" data-booth-id="${choice.id}" data-correct="${choice.correct}">${this.escapeHTML(choice.text)}</button>`).join('')}
      </div>
      ${submit('Carimbar decisao')}`;
  }

  if(data.mode === 'headlineOrder') {
    return `
      <div class="headline-line" data-headline-line><span>Monte a manchete aqui</span></div>
      <div class="word-bank headline-bank">
        ${data.words.map((word, index) => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}" data-word-index="${index}">${this.escapeHTML(word)}</button>`).join('')}
      </div>
      ${submit('Carimbar manchete')}`;
  }

  if(data.mode === 'wireBoard' || data.mode === 'connections') {
    return data.pairs.map(item => `
      <div class="activity-card wire-card" data-pair-id="${item.id}">
        <strong>${this.escapeHTML(item.clue)}</strong>
        <div class="choice-row">
          ${item.options.map(option => `<button class="mini-action-btn" type="button" data-value="${this.escapeHTML(option)}">${this.escapeHTML(option)}</button>`).join('')}
        </div>
      </div>
    `).join('') + submit(data.mode === 'wireBoard' ? 'Amarrar fios' : 'Carimbar mapa');
  }

  if(data.mode === 'supportMeter') {
    return `
      <div class="support-meter">
        <input class="year-slider" type="range" min="0" max="100" value="50" data-support-meter>
        <div class="year-scale"><span>${this.escapeHTML(data.minLabel)}</span><span>${this.escapeHTML(data.midLabel)}</span><span>${this.escapeHTML(data.maxLabel)}</span></div>
      </div>
      ${submit('Carimbar posicao')}`;
  }

  if(data.mode === 'factOpinion') {
    return data.statements.map(item => `
      <div class="activity-card" data-statement-id="${item.id}">
        ${this.escapeHTML(item.text)}
        <div class="choice-row">
          <button class="mini-action-btn" type="button" data-value="fato">Fato</button>
          <button class="mini-action-btn" type="button" data-value="opiniao">Opiniao</button>
        </div>
      </div>
    `).join('') + submit('Carimbar crivo');
  }

  if(data.mode === 'highlight') {
    return `
      <div class="activity-order-note typewriter">Marque os trechos que viram prova.</div>
      ${data.snippets.map(item => `<button class="activity-card" type="button" data-highlight-id="${item.id}">${this.escapeHTML(item.text)}</button>`).join('')}
      ${submit('Carimbar recorte')}`;
  }

  return data.options.map((opt, index) => `
    <button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}">
      <span class="check-box"></span>
      <span class="option-text">${this.escapeHTML(opt)}</span>
    </button>
  `).join('');
};

EvidenceSystem.bindActivity = function(overlay, title, text, data) {
  const state = { order: [], selected: new Set(), answers: {}, blankWord: null, blanks: {}, headline: [] };
  const feedback = overlay.querySelector('.quiz-feedback');

  const resetAfterWrong = () => {
    overlay.querySelectorAll('.selected, .answered, .linked').forEach(el => el.classList.remove('selected', 'answered', 'linked'));
    overlay.querySelectorAll('.check-box').forEach(el => { el.innerHTML = ''; });
    overlay.querySelectorAll('.drop-slot').forEach(slot => {
      slot.dataset.value = '';
      slot.classList.remove('filled');
      slot.innerHTML = `<span>${Number(slot.dataset.slotIndex) + 1}</span><em>Solte aqui</em>`;
    });
    overlay.querySelectorAll('.drag-card, .word-chip').forEach(el => { el.disabled = false; el.classList.remove('used'); });
    overlay.querySelectorAll('.blank-slot').forEach(slot => { slot.textContent = '_____'; slot.dataset.value = ''; });
    const line = overlay.querySelector('[data-headline-line]');
    if(line) line.innerHTML = `<span>${data.mode === 'headlineInvestigation' ? 'Monte o título aqui' : 'Monte a manchete aqui'}</span>`;
    state.order = [];
    state.selected.clear();
    state.answers = {};
    state.blanks = {};
    state.headline = [];
    state.blankWord = null;
  };

  const finish = (isCorrect, selectedAnswer) => {
    const answerMeta = { phaseNum: data.phaseNum, title, question: data.q, selectedAnswer, isCorrect };
    GameLogic.recordAnswer(answerMeta);

    if(isCorrect) {
      GameLogic.playSFX('stamp');
      feedback.innerHTML = '<div class="stamp-correct stamp-animated">DEFERIDO</div>';
      GameLogic.addEvidenceToInventory(title, text, answerMeta);
      GameLogic.unlockNextPhase(data.phaseNum);
      setTimeout(() => {
        const modal = document.getElementById('investigationModal');
        if(modal) modal.remove();
      }, 1600);
      return;
    }

    GameLogic.playSFX('error');
    feedback.innerHTML = '<div class="stamp-wrong">INDEFERIDO</div>';
    overlay.querySelector('.investigation-dossier')?.classList.add('shake-error');
    setTimeout(() => {
      overlay.querySelector('.investigation-dossier')?.classList.remove('shake-error');
      feedback.innerHTML = '';
      resetAfterWrong();
      GameLogic.showWrongAnswerHelp(data);
    }, 900);
  };

  const clearSlot = (slot) => {
    if(!slot) return;
    const oldId = slot.dataset.value;
    if(oldId) {
      const oldCard = overlay.querySelector(`[data-order-id="${CSS.escape(oldId)}"]`);
      if(oldCard) oldCard.disabled = false;
    }
    state.order[Number(slot.dataset.slotIndex)] = undefined;
    slot.dataset.value = '';
    slot.classList.remove('filled');
    slot.innerHTML = `<span>${Number(slot.dataset.slotIndex) + 1}</span><em>Solte aqui</em>`;
  };

  const placeOrder = (id, label, slot = null) => {
    const targetSlot = slot || Array.from(overlay.querySelectorAll('.drop-slot')).find(item => !item.dataset.value);
    if(!targetSlot) return;

    const previousSlot = Array.from(overlay.querySelectorAll('.drop-slot')).find(item => item.dataset.value === id);
    if(previousSlot && previousSlot !== targetSlot) clearSlot(previousSlot);

    const replacedId = targetSlot.dataset.value;
    if(replacedId && replacedId !== id) {
      const replacedCard = overlay.querySelector(`[data-order-id="${CSS.escape(replacedId)}"]`);
      if(replacedCard) replacedCard.disabled = false;
      const replacedIndex = state.order.indexOf(replacedId);
      if(replacedIndex >= 0) state.order[replacedIndex] = undefined;
    }

    state.order[Number(targetSlot.dataset.slotIndex)] = id;
    targetSlot.dataset.value = id;
    targetSlot.classList.add('filled');
    targetSlot.innerHTML = `<strong>${Number(targetSlot.dataset.slotIndex) + 1}</strong><span>${this.escapeHTML(label)}</span>`;
    const card = overlay.querySelector(`[data-order-id="${CSS.escape(id)}"]`);
    if(card) card.disabled = true;
  };

  overlay.querySelectorAll('[data-order-id]').forEach(button => {
    button.addEventListener('click', () => placeOrder(button.dataset.orderId, button.dataset.orderLabel || button.innerText.trim()));
    button.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', button.dataset.orderId);
    });
  });

  overlay.querySelectorAll('.drop-slot').forEach(slot => {
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain');
      const card = overlay.querySelector(`[data-order-id="${CSS.escape(id)}"]`);
      if(card) placeOrder(id, card.dataset.orderLabel || card.innerText.trim(), slot);
    });
  });

  overlay.querySelectorAll('[data-quiz-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.quizIndex);
      overlay.querySelectorAll('[data-quiz-index]').forEach(btn => btn.style.opacity = '0.6');
      button.style.opacity = '1';
      button.querySelector('.check-box').innerHTML = '<span style="font-weight:900; color:var(--wine);">X</span>';
      finish(index === data.correctIndex, data.options[index]);
    });
  });

  let marking = false;
  const markToken = (button) => {
    state.selected.add(button.dataset.tokenId);
    button.classList.add('selected');
  };
  overlay.querySelectorAll('.mark-token').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      marking = true;
      markToken(button);
      document.addEventListener('pointerup', () => { marking = false; }, { once: true });
    });
    button.addEventListener('pointerenter', () => {
      if(marking) markToken(button);
    });
    button.addEventListener('click', () => markToken(button));
  });
  overlay.querySelector('[data-year-slider]')?.addEventListener('input', event => {
    overlay.querySelector('[data-year-output]').innerText = event.target.value;
  });

  overlay.querySelectorAll('[data-highlight-id]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.highlightId;
      if(state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      button.classList.toggle('selected');
    });
  });

  const renderAssociationChip = (game, value) => {
    if(game.dataset.assocMode === 'quoteMatch') {
      const person = (data.people || []).find(item => item.id === value) || { id: value, name: value };
      return `${EvidenceSystem.renderPersonPortrait(person, 'tiny')}<strong>${EvidenceSystem.escapeHTML(person.name)}</strong>`;
    }
    return `<strong>${EvidenceSystem.escapeHTML(value)}</strong>`;
  };

  const refreshAssociationGame = (game) => {
    if(!game) return;
    game.querySelectorAll('[data-assoc-drop]').forEach(drop => {
      const value = state.answers[drop.dataset.assocDrop];
      drop.innerHTML = value ? renderAssociationChip(game, value) : '<span>Solte aqui</span>';
      drop.classList.toggle('assoc-filled', Boolean(value));
      drop.closest('[data-assoc-target]')?.classList.toggle('assoc-filled', Boolean(value));
    });
    game.querySelectorAll('[data-assoc-token]').forEach(token => {
      const used = Object.values(state.answers).includes(token.dataset.assocToken);
      const active = state.activeAssoc?.game === game && state.activeAssoc.value === token.dataset.assocToken;
      token.classList.toggle('assoc-used', used);
      token.classList.toggle('assoc-selected', active);
    });
  };

  const refreshAllAssociationGames = () => overlay.querySelectorAll('[data-assoc-game]').forEach(game => refreshAssociationGame(game));

  const assignAssociation = (game, targetId, value) => {
    if(!game || !targetId || !value) return;
    Object.keys(state.answers).forEach(key => {
      if(key !== targetId && state.answers[key] === value) delete state.answers[key];
    });
    state.answers[targetId] = value;
    state.activeAssoc = null;
    showFeedback('');
    refreshAllAssociationGames();
  };

  overlay.querySelectorAll('[data-assoc-token]').forEach(token => {
    token.addEventListener('click', () => {
      state.activeAssoc = {
        game: token.closest('[data-assoc-game]'),
        value: token.dataset.assocToken
      };
      refreshAllAssociationGames();
    });
    token.addEventListener('dragstart', event => {
      state.activeAssoc = {
        game: token.closest('[data-assoc-game]'),
        value: token.dataset.assocToken
      };
      event.dataTransfer.setData('text/plain', token.dataset.assocToken);
      event.dataTransfer.effectAllowed = 'move';
      token.classList.add('assoc-selected');
    });
    token.addEventListener('dragend', () => {
      refreshAllAssociationGames();
    });
  });

  overlay.querySelectorAll('[data-assoc-target], [data-assoc-drop]').forEach(target => {
    target.addEventListener('dragover', event => {
      event.preventDefault();
      target.closest('[data-assoc-target]')?.classList.add('assoc-hover');
    });
    target.addEventListener('dragleave', () => {
      target.closest('[data-assoc-target]')?.classList.remove('assoc-hover');
    });
    target.addEventListener('drop', event => {
      event.preventDefault();
      const card = target.closest('[data-assoc-target]');
      const game = target.closest('[data-assoc-game]');
      const value = event.dataTransfer.getData('text/plain') || state.activeAssoc?.value;
      card?.classList.remove('assoc-hover');
      assignAssociation(game, card?.dataset.assocTarget, value);
    });
  });

  overlay.querySelectorAll('[data-assoc-drop]').forEach(drop => {
    drop.addEventListener('click', () => {
      const game = drop.closest('[data-assoc-game]');
      if(state.activeAssoc?.game === game) assignAssociation(game, drop.dataset.assocDrop, state.activeAssoc.value);
      else showIncomplete('Escolha uma ficha de cima e encaixe aqui.');
    });
  });

  const moveLinkDrag = (event) => {
    if(!state.dragLink) return;
    if(!document.body.contains(overlay)) {
      document.removeEventListener('pointermove', moveLinkDrag);
      document.removeEventListener('pointerup', endLinkDrag);
      return;
    }
    const rect = state.dragLink.board.getBoundingClientRect();
    state.dragLink.x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    state.dragLink.y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    drawLinkBoard(state.dragLink.board, state.dragLink);
  };

  function endLinkDrag(event) {
    if(!state.dragLink) return;
    const drag = state.dragLink;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-link-right]');
    if(target && target.closest('[data-link-board]') === drag.board) {
      connectLinkNodes(drag.left, target);
    } else {
      state.dragLink = null;
      refreshLinkBoard(drag.board);
    }
    document.removeEventListener('pointermove', moveLinkDrag);
    document.removeEventListener('pointerup', endLinkDrag);
  }

  overlay.querySelectorAll('[data-link-left]').forEach(left => {
    left.addEventListener('pointerdown', event => {
      event.preventDefault();
      const board = left.closest('[data-link-board]');
      const rect = board.getBoundingClientRect();
      state.activeLink = { board, left };
      state.dragLink = {
        board,
        left,
        leftId: left.dataset.linkLeft,
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
      };
      left.setPointerCapture?.(event.pointerId);
      refreshLinkBoard(board);
      document.addEventListener('pointermove', moveLinkDrag);
      document.addEventListener('pointerup', endLinkDrag);
    });
  });

  overlay.querySelectorAll('[data-link-right]').forEach(right => {
    right.addEventListener('click', () => {
      if(state.activeLink?.board === right.closest('[data-link-board]')) connectLinkNodes(state.activeLink.left, right);
    });
  });

  overlay.querySelectorAll('[data-statement-id], [data-pair-id], [data-quote-id]').forEach(card => {
    card.querySelectorAll('[data-value]').forEach(button => {
      button.addEventListener('click', () => {
        const id = card.dataset.statementId || card.dataset.pairId || card.dataset.quoteId;
        state.answers[id] = button.dataset.value;
        card.classList.add('answered');
        card.querySelectorAll('[data-value]').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
      });
    });
  });

  overlay.querySelectorAll('.word-chip').forEach(button => {
    button.addEventListener('click', () => {
      if(overlay.querySelector('[data-headline-line]')) {
        state.headline.push(button.dataset.word);
        button.disabled = true;
        button.classList.add('used');
        overlay.querySelector('[data-headline-line]').innerHTML = state.headline.map(word => `<strong>${this.escapeHTML(word)}</strong>`).join(' ');
        return;
      }
      state.blankWord = button.dataset.word;
      overlay.querySelectorAll('.word-chip').forEach(chip => chip.classList.remove('selected'));
      button.classList.add('selected');
    });
    button.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', button.dataset.word);
    });
  });

  overlay.querySelectorAll('.blank-slot').forEach(slot => {
    const assign = (word) => {
      if(!word) return;
      slot.textContent = word;
      slot.dataset.value = word;
      state.blanks[slot.dataset.blankId] = word;
    };
    slot.addEventListener('click', () => assign(state.blankWord));
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => {
      event.preventDefault();
      assign(event.dataTransfer.getData('text/plain'));
    });
  });

  overlay.querySelectorAll('[data-booth-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.answers.booth = button.dataset.correct === 'true' ? 'correct' : button.innerText.trim();
      overlay.querySelectorAll('[data-booth-id]').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  overlay.querySelector('[data-submit-activity]')?.addEventListener('click', () => {
    if(data.mode === 'chronology' || data.mode === 'rightsStack') {
      const selectedOrder = state.order.filter(Boolean);
      const selectedAnswer = selectedOrder.join(' -> ');
      finish(selectedOrder.join('|') === data.correctOrder.join('|'), selectedAnswer || 'Sem ordem definida');
    } else if(data.mode === 'textHighlight') {
      const result = this.gradeTextHighlight(overlay, data);
      finish(result.isCorrect, result.selectedAnswer);
    } else if(data.mode === 'yearSlider') {
      const value = Number(overlay.querySelector('[data-year-slider]').value);
      finish(Math.abs(value - data.target) <= data.tolerance, String(value));
    } else if(data.mode === 'quoteMatch') {
      const correct = data.quotes.every(item => state.answers[item.id] === item.answer);
      finish(correct, data.quotes.map(item => `${item.text}: ${state.answers[item.id] || 'sem resposta'}`).join(' | '));
    } else if(data.mode === 'restoreText') {
      const correct = data.blanks.every(blank => state.blanks[blank.id] === blank.answer);
      finish(correct, data.blanks.map(blank => `${blank.id}: ${state.blanks[blank.id] || 'vazio'}`).join(' | '));
    } else if(data.mode === 'votingBooth') {
      finish(state.answers.booth === 'correct', state.answers.booth || 'sem decisao');
    } else if(data.mode === 'headlineOrder') {
      finish(state.headline.join('|') === data.correctOrder.join('|'), state.headline.join(' '));
    } else if(data.mode === 'wireBoard' || data.mode === 'connections') {
      const correct = data.pairs.every(item => state.answers[item.id] === item.answer);
      finish(correct, data.pairs.map(item => `${item.clue}: ${state.answers[item.id] || 'sem resposta'}`).join(' | '));
    } else if(data.mode === 'supportMeter') {
      const value = Number(overlay.querySelector('[data-support-meter]').value);
      finish(value >= data.correctRange[0] && value <= data.correctRange[1], String(value));
    } else if(data.mode === 'factOpinion') {
      const complete = data.statements.every(item => state.answers[item.id]);
      const correct = complete && data.statements.every(item => state.answers[item.id] === item.answer);
      finish(correct, data.statements.map(item => `${item.text}: ${state.answers[item.id] || 'sem resposta'}`).join(' | '));
    } else if(data.mode === 'highlight') {
      const correctIds = data.snippets.filter(item => item.important).map(item => item.id).sort();
      const selectedIds = Array.from(state.selected).sort();
      finish(correctIds.join('|') === selectedIds.join('|'), selectedIds.join(', ') || 'Nenhum trecho selecionado');
    }
  });
};

/* =========================================================
   LINHA DO TEMPO CUMULATIVA E ACERTO SEM DIALOGO
   ========================================================= */
GameLogic.getCumulativeTimelineEntries = function(upToChapterIndex = this.getActiveChapterIndex()) {
  const chapters = this.getChapters();
  const phases = this.getPhaseList();
  const progress = this.progress?.unlockedPhases || [1];
  const entries = [];

  chapters.slice(0, upToChapterIndex + 1).forEach((chapter, chapterIndex) => {
    const chapterPhases = phases.filter(phase => phase.chapterIndex === chapterIndex);
    chapter.timeline.forEach((entry, entryIndex) => {
      const phaseNum = chapterPhases[entryIndex]?.phaseNum || this.getChapterStartPhase(chapterIndex) + entryIndex;
      const completed = progress.includes(phaseNum + 1);
      const active = progress.includes(phaseNum) && !completed;
      const visible = chapterIndex < upToChapterIndex || completed || active || chapterIndex === upToChapterIndex;
      if(!visible) return;
      entries.push({
        ...entry,
        phaseNum,
        completed,
        active,
        chapterIndex,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title
      });
    });
  });

  return entries;
};

GameLogic.renderTimeline = function(animate = false) {
  const timeline = document.getElementById('timelineStrip');
  if(!timeline || !this.progress) return;
  if(typeof this.currentChapterIndex !== 'number') this.currentChapterIndex = this.getActiveChapterIndex();
  const entries = this.getCumulativeTimelineEntries(this.currentChapterIndex);

  timeline.innerHTML = `
    <div class="timeline-scroller">
      ${entries.map(entry => `
        <div class="timeline-item ${entry.completed ? 'completed' : ''} ${entry.active ? 'active' : ''}" data-phase="${entry.phaseNum}">
          <em>Cap. ${entry.chapterNumber}</em>
          <span>${entry.date}</span>
          <small>${entry.text}</small>
        </div>
      `).join('')}
    </div>
  `;

  if(animate) {
    timeline.classList.remove('timeline-flash');
    void timeline.offsetWidth;
    timeline.classList.add('timeline-flash');
  }
};

GameLogic.showChapterTimeline = function(chapterIndex, nextChapterIndex = null) {
  const chapter = this.getChapters()[chapterIndex];
  if(!chapter) return;
  const existing = document.getElementById('chapterTimelineOverlay');
  if(existing) existing.remove();

  const entries = this.getCumulativeTimelineEntries(chapterIndex);
  const overlay = document.createElement('div');
  overlay.className = 'chapter-timeline-overlay';
  overlay.id = 'chapterTimelineOverlay';
  if(nextChapterIndex !== null) overlay.dataset.nextChapterIndex = String(nextChapterIndex);
  overlay.innerHTML = `
    <div class="chapter-timeline-card">
      <div class="chapter-timeline-eyebrow">Capitulo ${chapter.number} completo</div>
      <h2 class="chapter-timeline-title">Linha do Tempo Descoberta</h2>
      <p class="chapter-timeline-subtitle">Tudo que o dossie revelou ate ${chapter.title}</p>
      <div class="chapter-timeline-list">
        ${entries.map(entry => `
          <div class="chapter-timeline-entry ${entry.chapterIndex === chapterIndex ? 'is-new' : ''}">
            <strong>${entry.date}</strong>
            <span>${entry.text}</span>
            <small>Capitulo ${entry.chapterNumber}</small>
          </div>
        `).join('')}
      </div>
      <button class="vintage-plate-btn" type="button" onclick="GameLogic.closeChapterTimeline()">
        <span class="plate-screw screw-left"></span>
        GUARDAR NO DOSSIÊ
        <span class="plate-screw screw-right"></span>
      </button>
    </div>`;
  document.body.appendChild(overlay);
};

GameLogic.closeChapterTimeline = function() {
  const overlay = document.getElementById('chapterTimelineOverlay');
  if(!overlay) return false;
  const nextChapterIndex = overlay.dataset.nextChapterIndex ? Number(overlay.dataset.nextChapterIndex) : null;
  overlay.remove();

  if(Number.isInteger(nextChapterIndex) && this.isChapterAvailable(nextChapterIndex)) {
    this.currentChapterIndex = nextChapterIndex;
    this.restoreGameState();
  }

  return true;
};

GameLogic.unlockNextPhase = function(current, options = {}) {
  const phases = this.getPhaseList();
  const total = phases.length;
  const next = current + 1;
  const currentPhase = phases.find(item => item.phaseNum === current);
  const nextPhase = phases.find(item => item.phaseNum === next);

  if(!this.progress.unlockedPhases.includes(next)) {
    this.progress.unlockedPhases.push(next);
    this.saveGameProgress();
  }

  this.syncBadges(true);

  if(currentPhase) this.currentChapterIndex = currentPhase.chapterIndex;
  this.restoreGameState();
  this.renderTimeline(true);

  const chapterPhases = phases.filter(item => item.chapterIndex === currentPhase?.chapterIndex);
  const lastInChapter = chapterPhases[chapterPhases.length - 1]?.phaseNum;
  if(!options.silent && (current === lastInChapter || current >= total)) {
    const nextChapterIndex = nextPhase ? nextPhase.chapterIndex : null;
    setTimeout(() => this.showChapterTimeline(currentPhase?.chapterIndex || this.currentChapterIndex, nextChapterIndex), 850);
  }

  return { currentPhase, nextPhase, total, lastInChapter };
};

GameLogic.updateHeaderAccountControls = function() {
  const authBtn = this.headerAuthBtn || document.getElementById('headerAuthBtn');
  const logoutBtn = this.logoutBtn || document.getElementById('logoutBtn');
  const playerName = document.getElementById('playerName');
  const headerAvatar = document.getElementById('headerAvatar');

  if(this.user) {
    if(playerName) playerName.innerText = this.user.fullName || this.user.name;
    if(authBtn) {
      authBtn.style.display = 'inline-block';
      authBtn.innerText = 'Perfil';
      authBtn.title = 'Abrir perfil';
    }
    if(logoutBtn) logoutBtn.style.display = 'inline-block';
    if(headerAvatar) {
      const progress = this.progress || this.store.ensureProgress(this.user.progress || {});
      const rank = this.getProfileRank(progress);
      headerAvatar.style.display = 'flex';
      headerAvatar.classList.add('ranked-avatar');
      headerAvatar.style.setProperty('--avatar-rank-fill', `${this.getAvatarRankFill(progress)}%`);
      headerAvatar.innerHTML = `<img src="assets/${this.user.avatar || 'bertha'}.png" alt="${this.user.fullName || this.user.name}"><span class="avatar-rank-badge" title="${rank.title}">${rank.icon}</span>`;
    }
    return;
  }

  if(playerName) playerName.innerText = "Credencial não registrada";
  if(authBtn) {
    authBtn.style.display = 'inline-block';
    authBtn.innerText = 'Entrar / Cadastro';
    authBtn.title = 'Entrar ou criar credencial';
  }
  if(logoutBtn) logoutBtn.style.display = 'none';
  if(headerAvatar) {
    headerAvatar.style.display = 'none';
    headerAvatar.classList.remove('ranked-avatar');
    headerAvatar.style.removeProperty('--avatar-rank-fill');
    headerAvatar.innerHTML = '';
  }
};

GameLogic.getBadgeCatalog = function() {
  return [
    { id: 'primeira-pista', icon: 'I', title: 'Primeira pista', text: 'Abriu o arquivo e iniciou a investigacao.', threshold: 2 },
    { id: 'linha-do-tempo', icon: 'II', title: 'Linha em ordem', text: 'Organizou os primeiros marcos do voto feminino.', threshold: 4 },
    { id: 'leitura-local', icon: 'III', title: 'Leitura local', text: 'Chegou aos registros de Muzambinho e suas atas.', threshold: 7 },
    { id: 'voz-publica', icon: 'IV', title: 'Voz publica', text: 'Comparou jornais, boatos e disputas de memoria.', threshold: 12 },
    { id: 'guardia-do-dossie', icon: 'V', title: 'Guardia do dossie', text: 'Avancou pelas ultimas pistas do arquivo.', threshold: 28 }
  ];
};

GameLogic.getAvatarCatalog = function() {
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
};

GameLogic.updateAvatarBio = function(value = null) {
  const selected = value || document.querySelector('input[name="p_avatar"]:checked')?.value || 'bertha';
  const info = this.getAvatarCatalog()[selected];
  const bio = document.getElementById('avatarBio');
  if(!bio || !info) return;
  bio.innerHTML = `<strong>${info.name}</strong><span>${info.role}</span><p>${info.bio}</p>`;
};

GameLogic.getUnlockedBadgeIds = function(progress = {}) {
  const unlockedPhases = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
  const highest = Math.max(...unlockedPhases, 1);
  return this.getBadgeCatalog()
    .filter(badge => highest >= badge.threshold)
    .map(badge => badge.id);
};

GameLogic.getBadgeProgress = function(progress = {}, badge, index) {
  const unlockedPhases = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
  const highest = Math.max(...unlockedPhases, 1);
  const previous = index === 0 ? 1 : this.getBadgeCatalog()[index - 1].threshold;
  const span = Math.max(1, badge.threshold - previous);
  const fill = Math.max(0, Math.min(100, Math.round(((highest - previous) / span) * 100)));
  return {
    fill,
    state: fill >= 100 ? 'unlocked' : fill > 0 ? 'partial' : 'locked'
  };
};

GameLogic.getProfileRank = function(progress = {}) {
  const catalog = this.getBadgeCatalog();
  const unlocked = this.getUnlockedBadgeIds(progress);
  return catalog.find(item => item.id === unlocked[unlocked.length - 1]) || { icon: '0', title: 'Arquivo inicial' };
};

GameLogic.getAvatarRankFill = function(progress = {}) {
  const unlockedPhases = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
  const highest = Math.max(...unlockedPhases, 1);
  return Math.max(8, Math.min(100, Math.round((highest / 28) * 100)));
};

GameLogic.syncBadges = function(announce = false) {
  if(!this.progress) return [];
  const previous = new Set(Array.isArray(this.progress.badges) ? this.progress.badges : []);
  const earned = this.getUnlockedBadgeIds(this.progress);
  const fresh = earned.filter(id => !previous.has(id));

  this.progress.badges = Array.from(new Set([...previous, ...earned]));
  if(fresh.length) {
    this.saveGameProgress();
    if(announce) {
      const catalog = this.getBadgeCatalog();
      fresh.forEach(id => {
        const badge = catalog.find(item => item.id === id);
        if(badge) this.showBadgeToast(badge);
      });
    }
  }

  return this.progress.badges;
};

GameLogic.showBadgeToast = function(badge) {
  const container = document.getElementById('toastContainer');
  if(!container || !badge) return;

  const toast = document.createElement('div');
  toast.className = 'toast badge-toast';
  toast.innerHTML = `<strong>Novo emblema: ${badge.title}</strong><span>${badge.text}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5200);
};

GameLogic.fillProfileForm = function() {
  if(!this.user) return;
  const setValue = (id, value) => {
    const field = document.getElementById(id);
    if(field) field.value = value || '';
  };

  setValue('p_fullname', this.user.fullName || this.user.name);
  setValue('p_name', this.user.name || this.user.username);
  setValue('p_password', this.user.password);
  setValue('p_age', this.user.ageGroup || this.user.age);
  setValue('p_gender', this.user.gender);
  setValue('p_location', this.user.location);
  setValue('p_occupation', this.user.occupation);
  setValue('p_level', this.user.knowledgeLevel || this.user.level || '3');

  const radio = document.querySelector(`input[name="p_avatar"][value="${this.user.avatar || 'bertha'}"]`);
  if(radio) radio.checked = true;
  this.updateAvatarBio(this.user.avatar || 'bertha');
};

GameLogic.renderProfileDashboard = function() {
  const dashboard = document.getElementById('profileDashboard');
  if(!dashboard || !this.user) return;

  const progress = this.progress || this.store.ensureProgress(this.user.progress || {});
  const highest = Math.max(...(progress.unlockedPhases || [1]), 1);
  const avatar = this.user.avatar || 'bertha';
  const rank = this.getProfileRank(progress);
  const rankFill = this.getAvatarRankFill(progress);
  const summaryAvatar = document.getElementById('profileSummaryAvatar');
  if(summaryAvatar) {
    summaryAvatar.style.setProperty('--avatar-rank-fill', `${rankFill}%`);
    summaryAvatar.innerHTML = `<img src="assets/${avatar}.png" alt="${this.user.fullName || this.user.name}"><span class="avatar-rank-badge" title="${rank.title}">${rank.icon}</span>`;
  }

  const summaryName = document.getElementById('profileSummaryName');
  if(summaryName) summaryName.innerText = this.user.fullName || this.user.name;

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
};

GameLogic.showProfileDecision = function({ title, message, confirmText, variant = '', onConfirm }) {
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
};

GameLogic.resetProgress = function() {
  if(!this.user) return;
  this.showProfileDecision({
    title: 'Restaurar progresso?',
    message: 'Essa ação apaga pistas, fases liberadas, respostas e emblemas desta credencial. A conta continua existindo, mas o jogo volta ao começo.',
    confirmText: 'Restaurar mesmo',
    variant: 'danger-soft',
    onConfirm: () => {
      const resetUser = this.store.resetCurrentProgress();
      if(resetUser) {
        this.user = resetUser;
        this.progress = this.store.ensureProgress(resetUser.progress);
        this.currentChapterIndex = 0;
        location.reload();
      }
    }
  });
};

GameLogic.deleteAccount = function() {
  if(!this.user) return;
  if(this.user.isAdmin) {
    this.showToast('A credencial admin deve permanecer no arquivo.');
    return;
  }
  this.showProfileDecision({
    title: 'Excluir conta?',
    message: 'Essa ação apaga a credencial e todo o progresso salvo. Não dá para desfazer depois.',
    confirmText: 'Excluir conta',
    variant: 'danger-strong',
    onConfirm: () => {
      const deletedName = this.user.name;
      if(this.store.deleteCurrentUser()) {
        fetch(`/api/user/${encodeURIComponent(deletedName)}`, { method: 'DELETE' }).catch(() => {});
        this.user = null;
        this.progress = this.store.blankProgress();
        location.reload();
      }
    }
  });
};

const LMOriginalBindEvents = GameLogic.bindEvents;
GameLogic.bindEvents = function() {
  LMOriginalBindEvents.call(this);

  this.notesBtn = document.getElementById('notesBtn');
  this.notebookOverlay = document.getElementById('notebookOverlay');
  this.closeNotesBtn = document.getElementById('closeNotesBtn');
  this.saveNotesBtn = document.getElementById('saveNotesBtn');
  this.notebookExpandBtn = document.getElementById('notebookExpandBtn');

  if (this.notesBtn) {
    this.notesBtn.onclick = () => this.openNotebook();
  }

  if (this.closeNotesBtn) {
    this.closeNotesBtn.onclick = () => this.closeNotebook();
  }

  if (this.saveNotesBtn) {
    this.saveNotesBtn.onclick = () => this.saveNotebookNotes();
  }

  if (this.notebookExpandBtn) {
    this.notebookExpandBtn.onclick = () => {
      this.setFullscreenMode(this.notebookOverlay, !this.notebookOverlay.classList.contains('fullscreen-mode'), this.notebookExpandBtn, 'Caderno');
    };
  }

  if (this.invBtn) {
    this.invBtn.onclick = () => this.openInventoryPanel();
  }

  if (this.closeInvBtn) {
    this.closeInvBtn.onclick = () => this.closeInventoryPanel();
  }

  document.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    const isTyping = ['input', 'textarea', 'select'].includes(tag);
    const notebookOpen = this.notebookOverlay?.classList.contains('active');

    if(document.getElementById('finalLetterOverlay') || document.getElementById('finalThanksScreen')) return;

    if (event.key === 'Escape' && notebookOpen) {
      event.preventDefault();
      this.closeNotebook();
      return;
    }

    if (!isTyping && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.openNotebook();
    }
  });
};

GameLogic.dismissDialogueLayer = function() {
  this.isDialogueActive = false;
  this.currentLineIndex = 0;

  if (this.npcOverlay) {
    this.npcOverlay.classList.remove('active', 'npc-lamp', 'npc-suffragist');
    this.npcOverlay.style.zIndex = '8000';
  }

  if (this.board) this.board.classList.remove('blurred');

  const modal = document.getElementById('investigationModal');
  if (modal) modal.style.filter = 'none';
};

GameLogic.openInventoryPanel = function() {
  this.setFullscreenMode(this.invOverlay, false, this.inventoryExpandBtn, 'Inventário');
  this.invOverlay?.classList.add('active');

  if (this.dialogueContext === 'tutorial_inv_wait' || (!this.progress?.tutorialCompleted && this.progress?.notebookIntroduced)) {
    this.invBtn?.classList.remove('highlight-pulse');
    this.dismissDialogueLayer();
    this.dialogueContext = 'tutorial_inv_open';
  }
};

GameLogic.closeInventoryPanel = function() {
  const shouldCompleteTour = this.dialogueContext === 'tutorial_inv_open' && !this.progress?.tutorialCompleted;

  this.invOverlay?.classList.remove('active');
  this.setFullscreenMode(this.invOverlay, false, this.inventoryExpandBtn, 'Inventário');

  if (shouldCompleteTour) {
    this.progress.tutorialCompleted = true;
    this.progress.notebookIntroduced = true;
    this.saveGameProgress();
    this.dialogueContext = null;

    setTimeout(() => {
      this.startDialogue([
        'Excelente. Sua pasta está pronta para receber as provas.',
        "Clique na Ficha 01: 'Nacional' para começar."
      ], 'normal');
    }, 350);
  }
};

GameLogic.openNotebook = function() {
  this.renderNotebook();
  this.setFullscreenMode(this.notebookOverlay, false, this.notebookExpandBtn, 'Caderno');
  this.notebookOverlay?.classList.add('active');

  if (this.dialogueContext === 'tutorial_notebook_wait' || (!this.progress?.tutorialCompleted && !this.progress?.notebookIntroduced)) {
    if (this.progress) {
      this.progress.notebookIntroduced = true;
      this.saveGameProgress();
    }

    this.notesBtn?.classList.remove('highlight-pulse');
    this.dismissDialogueLayer();
    this.dialogueContext = 'tutorial_notebook_open';
  }

  setTimeout(() => document.getElementById('fieldNotesText')?.focus(), 80);
};

GameLogic.closeNotebook = function() {
  const shouldContinueTour = this.dialogueContext === 'tutorial_notebook_open' && !this.progress?.tutorialCompleted;

  this.notebookOverlay?.classList.remove('active');
  this.setFullscreenMode(this.notebookOverlay, false, this.notebookExpandBtn, 'Caderno');

  if (shouldContinueTour) {
    this.dialogueContext = null;
    setTimeout(() => {
      this.startDialogue([
        'Muito bem. O Caderno de Campo guarda suas hipóteses durante a investigação.',
        'Agora abra o Inventário no topo da mesa para ver onde as provas ficam arquivadas.'
      ], 'tutorial_inv');
    }, 350);
  }
};

GameLogic.saveNotebookNotes = function() {
  if (!this.progress) return;
  this.progress.fieldNotes = {
    ...(this.progress.fieldNotes || {}),
    general: document.getElementById('fieldNotesText')?.value || ''
  };
  this.saveGameProgress();
  this.playSFX('stamp');
  this.closeNotebook();
  this.showToast('Anotações salvas no caderno.');
};

GameLogic.showToast = function(message) {
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
};

GameLogic.renderNotebook = function() {
  const text = document.getElementById('fieldNotesText');
  if (!this.progress) return;

  if (text) text.value = this.progress.fieldNotes?.general || '';
};

const LMOriginalStartDialogue = GameLogic.startDialogue;
GameLogic.startDialogue = function(lines, context) {
  const nextLines = Array.isArray(lines) ? [...lines] : [];

  if (context === 'tutorial_inv' && !this.progress?.notebookIntroduced && !nextLines.some(line => String(line).includes('Caderno de Campo'))) {
    nextLines.splice(2, 0, 'Também deixei um Caderno de Campo no topo da mesa. Use-o para anotar pistas, dúvidas e conclusões durante a investigação.');
  }

  LMOriginalStartDialogue.call(this, nextLines, context);

  const overlay = document.getElementById('npcOverlay');
  const nameTag = overlay?.querySelector('.npc-name-tag');

  overlay?.classList.remove('npc-lamp');
  overlay?.classList.add('npc-suffragist');
  if (nameTag) nameTag.innerText = 'A Sufragista';
};

const LMOriginalAdvanceDialogue = GameLogic.advanceDialogue;
GameLogic.advanceDialogue = function() {
  if (this.dialogueContext === 'tutorial_notebook_wait') return;
  const previousContext = this.dialogueContext;

  LMOriginalAdvanceDialogue.call(this);

  const currentLine = String(this.currentLines?.[this.currentLineIndex] || '');
  if (
    previousContext === 'tutorial_inv' &&
    this.isDialogueActive &&
    !this.progress?.notebookIntroduced &&
    currentLine.includes('Caderno de Campo')
  ) {
    this.notesBtn?.classList.add('highlight-pulse');
    this.dialogueContext = 'tutorial_notebook_wait';
  }

  if (!this.isDialogueActive) {
    document.getElementById('npcOverlay')?.classList.remove('npc-lamp', 'npc-suffragist');
  }
};

/* =========================================================
   DISTRIBUICAO FINAL: 27 FICHAS ORIENTADAS POR DADOS
   ========================================================= */
GameLogic.loadPhaseContent = async function() {
  try {
    const response = await fetch('content/phases.json?v=20260813i', { cache: 'no-store' });
    if(!response.ok) throw new Error('phase-content-not-found');
    this.phaseContent = await response.json();
  } catch (error) {
    console.warn('Conteudo externo das fases nao carregado. Usando fallback interno.', error);
    this.phaseContent = null;
  }
};

const LMStaticFallbackChapters = GameLogic.getChapters;
GameLogic.getChapters = function() {
  const chapters = this.phaseContent?.chapters;
  return Array.isArray(chapters) && chapters.length ? chapters : LMStaticFallbackChapters.call(this);
};

GameLogic.getPhaseList = function() {
  return this.getChapters().flatMap((chapter, chapterIndex) => {
    const start = this.getChapterStartPhase(chapterIndex);
    return chapter.phases.map((phase, phaseIndex) => ({
      ...phase,
      phaseNum: start + phaseIndex,
      phaseIndex,
      phaseLabel: `Fase ${phaseIndex + 1} de ${chapter.phases.length}`,
      chapterIndex,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      chapterCentralQuestion: chapter.centralQuestion || ''
    }));
  });
};

GameLogic.clickPhase = function(phaseNum) {
  if(!this.user) {
    this.openProfileModal(false);
    return;
  }
  if(this.isDialogueActive) return;
  this.playSFX('paper');

  const phase = this.getPhases()[phaseNum];
  if(!phase) return;
  this.openPhaseDossier(phase);
};

GameLogic.getPhaseByShortcut = function(shortcutNumber) {
  if(typeof this.currentChapterIndex !== 'number') {
    this.currentChapterIndex = this.getActiveChapterIndex();
  }

  const phaseIndex = shortcutNumber - 1;
  return this.getPhaseList().find(phase =>
    phase.chapterIndex === this.currentChapterIndex && phase.phaseIndex === phaseIndex
  ) || null;
};

GameLogic.isPhaseShortcutBlocked = function() {
  const profileModal = document.getElementById('modalOverlay');
  const menu = document.getElementById('fullMenu');

  return Boolean(
    document.getElementById('investigationModal') ||
    document.getElementById('phaseIntroOverlay') ||
    document.getElementById('chapterTimelineOverlay') ||
    this.notebookOverlay?.classList.contains('active') ||
    this.invOverlay?.classList.contains('active') ||
    profileModal?.classList.contains('active') ||
    menu?.classList.contains('active')
  );
};

GameLogic.startPhaseIntro = function(phase) {
  const existing = document.getElementById('phaseIntroOverlay');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'phase-intro-overlay';
  overlay.id = 'phaseIntroOverlay';
  overlay.innerHTML = `
    <div class="phase-intro-card" role="dialog" aria-modal="true" aria-labelledby="phaseIntroTitle">
      <button class="close-dossier-new phase-intro-close" type="button" aria-label="Fechar introducao">&times;</button>
      <span class="phase-intro-kicker">Capitulo ${this.escapeText(phase.chapterNumber)} &bull; ${this.escapeText(phase.phaseLabel)}</span>
      <h2 id="phaseIntroTitle">${this.escapeText(phase.title)}</h2>
      <p class="phase-intro-question">${this.escapeText(phase.chapterCentralQuestion || phase.q || '')}</p>
      <div class="phase-intro-note">
        <strong>A Sufragista</strong>
        <p>${this.escapeText(phase.intro || 'Observe a fonte, procure evidencias e confirme sua interpretacao somente quando estiver pronta.')}</p>
      </div>
      <div class="phase-intro-actions">
        <button class="btn-secondary phase-intro-cancel" type="button">Voltar</button>
        <button class="btn-primary phase-intro-start" type="button">Comecar investigacao</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.phase-intro-close')?.addEventListener('click', close);
  overlay.querySelector('.phase-intro-cancel')?.addEventListener('click', close);
  overlay.querySelector('.phase-intro-start')?.addEventListener('click', () => {
    close();
    this.openPhaseDossier(phase);
  });
};

GameLogic.openPhaseDossier = function(phase) {
  EvidenceSystem.spawnEvidence(phase.t, phase.c, phase);
  this.registerPhaseStarted(phase);
};

GameLogic.escapeText = function(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

GameLogic.registerPhaseStarted = function(phase) {
  if(!this.progress || !phase) return;
  const key = String(phase.phaseNum);
  this.progress.phaseRecords = this.progress.phaseRecords || {};
  const current = this.progress.phaseRecords[key] || {};
  this.progress.phaseRecords[key] = {
    ...current,
    state: current.state || 'INTRO',
    startedAt: current.startedAt || new Date().toISOString(),
    gameId: `C${phase.chapterIndex + 1}F${phase.phaseIndex + 1}`,
    title: phase.title
  };
  this.recordGameEvent('game_started', phase, {});
  this.saveGameProgress();
};

GameLogic.recordGameEvent = function(event, phase, payload = {}) {
  if(!this.progress || !phase) return;
  this.progress.gameEvents = Array.isArray(this.progress.gameEvents) ? this.progress.gameEvents : [];
  this.progress.gameEvents.push({
    event,
    gameId: `C${phase.chapterIndex + 1}F${phase.phaseIndex + 1}`,
    phaseNum: phase.phaseNum,
    userId: this.user?.name || this.user?.username || 'local',
    timestamp: new Date().toISOString(),
    ...payload
  });
  if(this.progress.gameEvents.length > 180) this.progress.gameEvents = this.progress.gameEvents.slice(-180);
};

GameLogic.computePhaseScore = function(isCorrect, attempts = 1, hintsUsed = 0, completedByExplanation = false) {
  if(completedByExplanation) return 30;
  if(!isCorrect) return 30;
  if(attempts <= 1 && hintsUsed === 0) return 100;
  if(attempts <= 2 && hintsUsed <= 1) return 70;
  return 50;
};

GameLogic.recordAnswer = function(answerMeta) {
  if(!this.user || !this.progress) return;
  const nextAnswer = {
    ...answerMeta,
    answeredAt: new Date().toISOString()
  };

  this.progress.answers = Array.isArray(this.progress.answers) ? this.progress.answers : [];
  const existingIndex = this.progress.answers.findIndex(item => item.phaseNum === nextAnswer.phaseNum);
  if(existingIndex >= 0) this.progress.answers[existingIndex] = nextAnswer;
  else this.progress.answers.push(nextAnswer);

  this.progress.phaseRecords = this.progress.phaseRecords || {};
  const key = String(nextAnswer.phaseNum);
  this.progress.phaseRecords[key] = {
    ...(this.progress.phaseRecords[key] || {}),
    state: nextAnswer.completedByExplanation ? 'EXPLANATION_SHOWN' : nextAnswer.isCorrect ? 'CORRECT' : 'INCORRECT',
    attempts: nextAnswer.attempts || 1,
    hintsUsed: nextAnswer.hintsUsed || 0,
    score: nextAnswer.score || 0,
    selectedAnswer: nextAnswer.selectedAnswer,
    completedAt: nextAnswer.completedAt || null
  };

  this.saveGameProgress();
  this.renderInventory();
};

GameLogic.addEvidenceToInventory = function(title, text, answerMeta = null) {
  if(!this.progress) return;
  this.progress.collectedEvidence = Array.isArray(this.progress.collectedEvidence) ? this.progress.collectedEvidence : [];
  const reward = answerMeta?.evidenceReward || {};
  const source = answerMeta?.source || {};
  const evidence = {
    id: reward.id || `EV-${answerMeta?.phaseNum || Date.now()}`,
    title: reward.title || title,
    text,
    summary: reward.summary || '',
    category: reward.category || 'evidencia',
    chapter: answerMeta?.chapterTitle || '',
    origin: source.collection || source.type || '',
    explanation: reward.explanation || '',
    answer: answerMeta
  };

  const existingIndex = this.progress.collectedEvidence.findIndex(item => item.id === evidence.id || item.title === evidence.title);
  if(existingIndex >= 0) this.progress.collectedEvidence[existingIndex] = { ...this.progress.collectedEvidence[existingIndex], ...evidence };
  else this.progress.collectedEvidence.push(evidence);

  const phase = this.getPhaseList().find(item => item.phaseNum === answerMeta?.phaseNum) || { phaseNum: answerMeta?.phaseNum || 0, chapterIndex: 0, phaseIndex: 0 };
  this.recordGameEvent('evidence_collected', phase, { evidenceId: evidence.id });
  this.saveGameProgress();
  this.renderInventory();
};

GameLogic.getBadgeCatalog = function() {
  return [
    { id: 'primeira-pista', icon: 'I', title: 'Primeira pista', text: 'Abriu o arquivo e iniciou a investigacao.', threshold: 2 },
    { id: 'linha-do-tempo', icon: 'II', title: 'Linha em ordem', text: 'Reconstruiu os primeiros marcos do voto feminino.', threshold: 6 },
    { id: 'leitura-local', icon: 'III', title: 'Leitura local', text: 'Chegou aos registros de Muzambinho e suas fontes.', threshold: 10 },
    { id: 'voz-publica', icon: 'IV', title: 'Voz publica', text: 'Comparou jornais, boatos e disputas de memoria.', threshold: 18 },
    { id: 'guardia-do-dossie', icon: 'V', title: 'Guardia do dossie', text: 'Avancou ate a montagem do dossie final.', threshold: 28 }
  ];
};

GameLogic.getAvatarRankFill = function(progress = {}) {
  const unlockedPhases = Array.isArray(progress.unlockedPhases) && progress.unlockedPhases.length ? progress.unlockedPhases : [1];
  const highest = Math.max(...unlockedPhases, 1);
  return Math.max(8, Math.min(100, Math.round((highest / 28) * 100)));
};

EvidenceSystem.sourceInfoHTML = function(source = {}) {
  const empty = !source || !Object.keys(source).length;
  if(empty) return '<p>Fonte em preparacao para esta ficha.</p>';
  const rows = [
    ['Tipo', source.type],
    ['Autoria', source.author],
    ['Data', source.date],
    ['Local', source.place],
    ['Acervo', source.collection],
    ['Observacao', source.note]
  ].filter(([, value]) => value);
  return rows.map(([label, value]) => `<p><strong>${label}:</strong> ${this.escapeHTML(value)}</p>`).join('');
};

EvidenceSystem.referenceInfoHTML = function(source = {}, kind = 'historical') {
  if(!source || !Object.keys(source).length) {
    return '<p>Referência em preparação para esta ficha.</p>';
  }

  const labels = kind === 'didactic'
    ? [
        ['Tipo', source.type],
        ['Autoria', source.author],
        ['Data', source.date],
        ['Natureza', source.nature],
        ['Base historiográfica principal', source.basis]
      ]
    : [
        ['Tipo', source.type],
        ['Autoria', source.author],
        ['Obra', source.work],
        ['Edição', source.edition],
        ['Data', source.date],
        ['Local/Editora', source.placePublisher],
        ['Página', source.page],
        ['Capítulo', source.chapter],
        ['Seção', source.section],
        ['Trecho apresentado', source.excerpt],
        ['Referência', source.reference]
      ];

  return labels
    .filter(([, value]) => value)
    .map(([label, value]) => `<p><strong>${label}:</strong> ${this.escapeHTML(value)}</p>`)
    .join('');
};

EvidenceSystem.spawnEvidence = function(title, text, phaseData) {
  document.getElementById('investigationModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'investigationModal';
  overlay.className = 'investigation-overlay active';
  const activityHTML = this.renderActivity(phaseData);
  const historicalSourceHTML = this.referenceInfoHTML(phaseData.historicalSource || phaseData.source, 'historical');
  const didacticSourceHTML = this.referenceInfoHTML(phaseData.didacticSource || {
    type: phaseData.source?.type,
    author: phaseData.source?.author,
    date: phaseData.source?.date,
    nature: phaseData.source?.note,
    basis: phaseData.source?.collection
  }, 'didactic');

  overlay.innerHTML = `
    <div class="investigation-dossier" id="dossierContainer">
      <div class="dossier-clip"></div>
      <div class="dossier-page page-left phase-source-page">
        <div class="dossier-paper-pad">
          <div class="form-tag">DOCUMENTO APREENDIDO</div>
          <h2 class="evidence-title">${this.escapeHTML(title)}</h2>
          <div class="source-tabs" role="tablist" aria-label="Documentação da fase">
            <button type="button" class="source-tab active" data-source-tab="document">Documento</button>
            <button type="button" class="source-tab" data-source-tab="historical">Fonte histórica</button>
            <button type="button" class="source-tab" data-source-tab="didactic">Fonte didática</button>
          </div>
          <div class="source-panel active" data-source-panel="document">
            <div class="evidence-text source-document-text">${text}</div>
          </div>
          <div class="source-panel source-info source-reference-sheet" data-source-panel="historical">${historicalSourceHTML}</div>
          <div class="source-panel source-info source-reference-sheet" data-source-panel="didactic">${didacticSourceHTML}</div>
        </div>
      </div>
      <div class="dossier-page page-right phase-activity-page">
        <button class="fullscreen-toggle investigation-fullscreen-toggle" type="button" title="Expandir Pergunta" aria-label="Expandir Pergunta" aria-pressed="false" onclick="EvidenceSystem.toggleFullscreen(this)">&#x26F6;</button>
        <button class="close-investigation" title="Fechar Pasta" onclick="this.closest('.investigation-overlay').remove()">&#215;</button>
        <header class="phase-header">
          <span class="phase-kicker">Capitulo ${this.escapeHTML(phaseData.chapterNumber)} &bull; ${this.escapeHTML(phaseData.phaseLabel || '')}</span>
          <h2>${this.escapeHTML(phaseData.title || 'Questionario de Analise')}</h2>
          <p>${this.escapeHTML(phaseData.chapterCentralQuestion || '')}</p>
        </header>
        <p class="quiz-question">${this.escapeHTML(phaseData.q)}</p>
        <div class="activity-area">${activityHTML}</div>
        <div class="phase-hint-box" aria-live="polite"></div>
        <div class="quiz-feedback" aria-live="polite"></div>
        <button type="button" class="phase-reset-text" data-reset-activity>limpar tentativa</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  this.bindActivity(overlay, title, text, phaseData);
};

EvidenceSystem.getPersonImage = function(person = {}) {
  const key = String(person.id || person.name || '').toLowerCase();
  const portraits = {
    bertha: 'assets/bertha.png',
    celina: 'assets/celina.png',
    leolinda: 'assets/leolinda.png',
    mietta: 'assets/mietta.png',
    myrthes: 'assets/myrthes.png',
    carlota: 'assets/carlota.png'
  };
  if(portraits[key]) return portraits[key];
  if(key.includes('bertha')) return portraits.bertha;
  if(key.includes('celina')) return portraits.celina;
  if(key.includes('leolinda')) return portraits.leolinda;
  if(key.includes('mietta')) return portraits.mietta;
  return '';
};

EvidenceSystem.renderPersonPortrait = function(person = {}, sizeClass = '') {
  const name = person.name || person.id || 'Personagem';
  const initial = this.escapeHTML(String(name).charAt(0).toUpperCase());
  const src = this.getPersonImage(person);
  const classes = `person-portrait ${sizeClass}`.trim();

  if(!src) return `<span class="${classes} no-photo" aria-hidden="true">${initial}</span>`;
  return `<span class="${classes}"><img src="${src}" alt="${this.escapeHTML(name)}" onerror="const p=this.closest('.person-portrait'); if(p){p.classList.add('no-photo'); p.textContent='${initial}';}"></span>`;
};

EvidenceSystem.renderActivity = function(data) {
  const submit = (label = 'Confirmar resposta') => `<button class="btn-primary activity-submit" type="button" data-submit-activity>${label}</button>`;

  if(data.mode === 'chronology' || data.mode === 'rightsStack') {
    const items = data.events || data.rights || [];
    const bankItems = [...items];
    if(data.shuffleEvents && bankItems.length > 1) {
      for(let index = bankItems.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [bankItems[index], bankItems[swapIndex]] = [bankItems[swapIndex], bankItems[index]];
      }
      if(bankItems.every((item, index) => item.id === items[index].id)) bankItems.push(bankItems.shift());
    }
    const orderClass = data.mode === 'rightsStack' ? 'rights-lane' : 'chronology-lane';
    return `
      <div class="drop-lane ${orderClass}">
        ${items.map((_, index) => `<div class="drop-slot" data-slot-index="${index}"><span>${index + 1}</span><em>Toque ou solte aqui</em></div>`).join('')}
      </div>
      <div class="activity-bank ${data.mode === 'chronology' ? 'chronology-bank' : ''}">
        ${bankItems.map(item => {
          const orderLabel = item.slotLabel || (item.title ? `${item.title}: ${item.label}` : item.label);
          return `<button class="activity-card drag-card" type="button" draggable="true" data-order-id="${item.id}" data-order-label="${this.escapeHTML(orderLabel)}">
            ${data.mode !== 'rightsStack' && !data.concealDates ? `<strong class="chronology-card-date">${this.escapeHTML(item.year || '')}</strong>` : ''}
            ${item.title ? `<span class="chronology-card-title">${this.escapeHTML(item.title)}</span>` : ''}
            <span class="chronology-card-copy">${this.escapeHTML(item.label)}</span>
          </button>`;
        }).join('')}
      </div>
      ${submit(data.mode === 'rightsStack' ? 'Carimbar escada' : 'Verificar ordem')}`;
  }

  if(data.mode === 'textHighlight') {
    const tokens = this.tokenizeHighlightText(data);
    return `
      <div class="mission-card">${this.escapeHTML(data.q)}</div>
      <div class="mark-text" data-mark-text>
        ${tokens.map(token => token.selectable
          ? `<button class="mark-token" type="button" data-token-id="${token.id}" data-answer="${token.answer}">${this.escapeHTML(token.text)}</button>`
          : `<span>${this.escapeHTML(token.text)}</span>`).join('')}
      </div>
      ${submit('Confirmar marcacoes')}`;
  }

  if(data.mode === 'quoteMatch') {
    const people = [...data.people];
    const strategies = [...data.quotes];
    if(data.shuffleAssociations && people.length > 1) {
      for(let index = people.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [people[index], people[swapIndex]] = [people[swapIndex], people[index]];
      }
      for(let index = strategies.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [strategies[index], strategies[swapIndex]] = [strategies[swapIndex], strategies[index]];
      }
    }
    return `
      <div class="assoc-game quote-drop-game" data-assoc-game data-assoc-mode="quoteMatch">
        <div class="quote-person-shelf assoc-bank">
          ${people.map(person => `
            <button class="assoc-token quote-person-token" type="button" draggable="true" data-assoc-token="${person.id}" data-token-label="${this.escapeHTML(person.name)}" data-initial="${this.escapeHTML(person.name.charAt(0))}">
              ${this.renderPersonPortrait(person)}
              <strong>${this.escapeHTML(person.name)}</strong>
            </button>
          `).join('')}
        </div>
        <div class="quote-phrase-grid">
          ${strategies.map(quote => `
            <article class="quote-drop-card" data-assoc-target="${quote.id}">
              <button class="quote-drop-corner assoc-drop-zone" type="button" data-assoc-drop="${quote.id}"><span>Solte aqui</span></button>
              ${quote.title ? `<strong class="quote-strategy-label">${this.escapeHTML(quote.title)}</strong>` : ''}
              <p>${this.escapeHTML(quote.text)}</p>
            </article>
          `).join('')}
        </div>
      </div>
      ${data.closingQuestion ? `
        <section class="association-closing-question">
          <h3>${this.escapeHTML(data.closingQuestion.question)}</h3>
          <div class="quiz-options">
            ${data.closingQuestion.options.map((option, index) => `
              <button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}">
                <span class="check-box"></span>
                <span class="option-text">${this.escapeHTML(option)}</span>
              </button>`).join('')}
          </div>
        </section>` : ''}
      ${submit('Confirmar associacoes')}`;
  }

  if(data.mode === 'restoreText') {
    let blankIndex = 0;
    const textHTML = data.template.map(part => {
      const blank = data.blanks[blankIndex];
      if(blank && part === blank.answer) {
        blankIndex += 1;
        return `<button class="blank-slot" type="button" data-blank-id="${blank.id}" data-answer="${this.escapeHTML(blank.answer)}">_____</button>`;
      }
      return `<span>${this.escapeHTML(part)}</span>`;
    }).join('');
    return `
      <div class="restore-text">${textHTML}</div>
      <div class="word-bank">
        ${data.words.map(word => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}">${this.escapeHTML(word)}</button>`).join('')}
      </div>
      ${submit('Confirmar restauracao')}`;
  }

  if(data.mode === 'restoreInvestigation') {
    let blankIndex = 0;
    const textHTML = data.template.map(part => {
      const blank = data.blanks[blankIndex];
      if(blank && part === blank.answer) {
        blankIndex += 1;
        return `<button class="blank-slot" type="button" data-blank-id="${blank.id}" data-answer="${this.escapeHTML(blank.answer)}">_____</button>`;
      }
      return `<span>${this.escapeHTML(part)}</span>`;
    }).join('');
    return `
      <section class="restore-investigation">
        <div class="restore-step-label">Etapa 1 &bull; Restauração da nota</div>
        <div class="restore-text">${textHTML}</div>
        <div class="word-bank restore-word-bank">
          ${data.words.map(word => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}">${this.escapeHTML(word)}</button>`).join('')}
        </div>
        <section class="sequential-activity documentary-rounds restore-rounds" data-sequential-activity data-sequential-mode="quiz">
          <header class="sequential-progress">
            <span data-round-counter>Questão 1 de ${data.rounds.length}</span>
            <div class="sequential-progress-track" aria-hidden="true"><i data-round-progress></i></div>
          </header>
          <div class="sequential-stage" data-round-stage></div>
          <nav class="sequential-nav" aria-label="Navegação pelas questões de interpretação">
            <button class="sequential-arrow-button previous" type="button" data-round-previous aria-label="Questão anterior" title="Questão anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
            <button class="sequential-arrow-button next" type="button" data-round-next aria-label="Próxima questão" title="Próxima questão"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
            <span class="sequential-complete-stamp" data-round-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
          </nav>
        </section>
      </section>
      ${submit('Concluir restauração e análise')}`;
  }

  if(data.mode === 'votingBooth') {
    return `
      <div class="booth-card">
        ${data.choices.map(choice => `<button class="activity-card" type="button" data-booth-id="${choice.id}" data-correct="${choice.correct}">${this.escapeHTML(choice.text)}</button>`).join('')}
      </div>
      ${submit('Confirmar decisao')}`;
  }

  if(data.mode === 'multiRoundQuiz') {
    return `
      <section class="sequential-activity documentary-rounds" data-sequential-activity data-sequential-mode="quiz">
        <header class="sequential-progress">
          <span data-round-counter>Rodada 1 de ${data.rounds.length}</span>
          <div class="sequential-progress-track" aria-hidden="true"><i data-round-progress></i></div>
        </header>
        <div class="sequential-stage" data-round-stage></div>
        <nav class="sequential-nav" aria-label="Navegação pelas rodadas">
          <button class="sequential-arrow-button previous" type="button" data-round-previous aria-label="Rodada anterior" title="Rodada anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
          <button class="sequential-arrow-button next" type="button" data-round-next aria-label="Próxima rodada" title="Próxima rodada"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
          <span class="sequential-complete-stamp" data-round-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
        </nav>
      </section>
      ${submit('Carimbar quatro rodadas')}`;
  }

  if(data.mode === 'interviewBooth') {
    return `
      <section class="sequential-activity interview-rounds" data-sequential-activity data-sequential-mode="interview">
        <header class="sequential-progress">
          <span data-round-counter>Entrevista 1 de ${data.interviews.length}</span>
          <div class="sequential-progress-track" aria-hidden="true"><i data-round-progress></i></div>
        </header>
        <div class="sequential-stage" data-round-stage></div>
        <nav class="sequential-nav" aria-label="Navegação pelas entrevistas">
          <button class="sequential-arrow-button previous" type="button" data-round-previous aria-label="Entrevista anterior" title="Entrevista anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
          <button class="sequential-arrow-button next" type="button" data-round-next aria-label="Próxima entrevista" title="Próxima entrevista"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
          <span class="sequential-complete-stamp" data-round-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
        </nav>
      </section>
      ${submit('Confirmar decisões da cabine')}`;
  }

  if(data.mode === 'headlineOrder') {
    return `
      <div class="headline-line" data-headline-line><span>Monte a manchete aqui</span></div>
      <div class="word-bank headline-bank">
        ${data.words.map((word, index) => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}" data-word-index="${index}">${this.escapeHTML(word)}</button>`).join('')}
      </div>
      ${submit('Confirmar manchete')}`;
  }

  if(data.mode === 'headlineInvestigation') {
    return `
      <section class="headline-investigation">
        <div class="headline-step-label">Etapa 1 &bull; Reconstrução do título</div>
        <div class="headline-line" data-headline-line><span>Monte o título aqui</span></div>
        <div class="word-bank headline-bank">
          ${data.words.map((word, index) => `<button class="word-chip" type="button" draggable="true" data-word="${this.escapeHTML(word)}" data-word-index="${index}">${this.escapeHTML(word)}</button>`).join('')}
        </div>
        <blockquote class="headline-source-fragment">
          <span>Etapa 2 &bull; Fragmento do documento</span>
          <p>${this.escapeHTML(data.fragment || '')}</p>
        </blockquote>
        <section class="sequential-activity documentary-rounds headline-rounds" data-sequential-activity data-sequential-mode="quiz">
          <header class="sequential-progress">
            <span data-round-counter>Rodada 1 de ${data.rounds.length}</span>
            <div class="sequential-progress-track" aria-hidden="true"><i data-round-progress></i></div>
          </header>
          <div class="sequential-stage" data-round-stage></div>
          <nav class="sequential-nav" aria-label="Navegação pela leitura da manchete">
            <button class="sequential-arrow-button previous" type="button" data-round-previous aria-label="Análise anterior" title="Análise anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
            <button class="sequential-arrow-button next" type="button" data-round-next aria-label="Próxima análise" title="Próxima análise"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
            <span class="sequential-complete-stamp" data-round-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
          </nav>
        </section>
      </section>
      ${submit('Concluir investigação da manchete')}`;
  }

  if(data.mode === 'wireBoard') {
    const options = Array.from(new Set(data.pairs.flatMap(item => item.options || [])));
    return `
      <div class="assoc-game pair-drop-game" data-assoc-game data-assoc-mode="wireBoard">
        <div class="pair-option-shelf assoc-bank">
          ${options.map(option => `<button class="assoc-token pair-option-token" type="button" draggable="true" data-assoc-token="${this.escapeHTML(option)}" data-token-label="${this.escapeHTML(option)}">${this.escapeHTML(option)}</button>`).join('')}
        </div>
        <div class="pair-target-grid">
          ${data.pairs.map(item => `
            <article class="pair-drop-card" data-assoc-target="${item.id}">
              <strong>${this.escapeHTML(item.clue)}</strong>
              <button class="pair-drop-slot assoc-drop-zone" type="button" data-assoc-drop="${item.id}"><span>Solte aqui</span></button>
            </article>
          `).join('')}
        </div>
      </div>
      ${submit('Confirmar associacoes')}`;
  }

  if(data.mode === 'connections') {
    const impactItems = data.impacts
      ? [...data.impacts]
      : Array.from(new Set(data.pairs.flatMap(item => item.options || []))).map(option => ({ id: option, title: option, text: '' }));
    if(data.shuffleAssociations && impactItems.length > 1) {
      for(let index = impactItems.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [impactItems[index], impactItems[swapIndex]] = [impactItems[swapIndex], impactItems[index]];
      }
    }
    return `
      <div class="assoc-game pair-drop-game connection-drop-game" data-assoc-game data-assoc-mode="connections">
        <div class="pair-option-shelf connection-impact-shelf assoc-bank">
          ${impactItems.map(item => `<button class="assoc-token pair-option-token connection-impact-token" type="button" draggable="true" data-assoc-token="${this.escapeHTML(item.id)}" data-token-label="${this.escapeHTML(item.title)}"><strong>${this.escapeHTML(item.title)}</strong>${item.text ? `<span>${this.escapeHTML(item.text)}</span>` : ''}</button>`).join('')}
        </div>
        <div class="pair-target-grid connection-strategy-grid">
          ${data.pairs.map(item => `
            <article class="pair-drop-card" data-assoc-target="${item.id}">
              <strong>${this.escapeHTML(item.clue)}</strong>
              ${item.description ? `<p>${this.escapeHTML(item.description)}</p>` : ''}
              <button class="pair-drop-slot assoc-drop-zone" type="button" data-assoc-drop="${item.id}"><span>Solte aqui</span></button>
            </article>
          `).join('')}
        </div>
      </div>
      ${data.closingQuestion ? `
        <section class="association-closing-question">
          <h3>${this.escapeHTML(data.closingQuestion.question)}</h3>
          <div class="quiz-options">
            ${data.closingQuestion.options.map((option, index) => `
              <button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}">
                <span class="check-box"></span>
                <span class="option-text">${this.escapeHTML(option)}</span>
              </button>`).join('')}
          </div>
        </section>` : ''}
      ${submit('Confirmar associacoes')}`;
  }

  if(data.mode === 'factOpinion') {
    const categories = data.categories || [
      { id: 'fato', label: 'Fato' },
      { id: 'opiniao', label: 'Opinião' }
    ];
    return `
      <div class="classification-legend" aria-label="Categorias da classificação">
        ${categories.map(category => `<span>${this.escapeHTML(category.label)}</span>`).join('')}
      </div>
      <div class="classification-list">
        ${data.statements.map((item, index) => `
          <article class="activity-card classification-card" data-statement-id="${item.id}">
            <span class="classification-number">${String(index + 1).padStart(2, '0')}</span>
            <p>${this.escapeHTML(item.text)}</p>
            <div class="choice-row classification-choice-row">
              ${categories.map(category => `<button class="mini-action-btn" type="button" data-value="${this.escapeHTML(category.id)}">${this.escapeHTML(category.label)}</button>`).join('')}
            </div>
          </article>
        `).join('')}
      </div>
      ${submit('Confirmar classificação')}`;
  }

  if(data.mode === 'highlight') {
    return `
      <div class="activity-order-note typewriter">Marque os trechos que viram prova.</div>
      ${data.snippets.map(item => `<button class="activity-card" type="button" data-highlight-id="${item.id}">${this.escapeHTML(item.text)}</button>`).join('')}
      ${submit('Analisar selecao')}`;
  }

  if(data.mode === 'wornDocument') {
    return `
      <div class="worn-document">
        <div class="worn-paper worn-paper-magnifier" data-worn-paper tabindex="0" role="button" aria-label="Passe a lupa pelo documento para revelar o texto">
          <div class="worn-cover">
            <span>Documento desgastado</span>
            <p>Passe a lupa por cima do papel para revelar o recorte.</p>
          </div>
          <div class="worn-hidden-text" data-worn-text>${this.escapeHTML(data.restoreText || '')}</div>
          <span class="magnifier-cursor" data-magnifier-cursor aria-hidden="true"><img src="assets/lupa.png" alt=""></span>
        </div>
      </div>
      <div class="quiz-options">
        ${data.options.map((opt, index) => `<button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}"><span class="check-box"></span><span class="option-text">${this.escapeHTML(opt)}</span></button>`).join('')}
      </div>
      ${submit('Confirmar interpretacao')}`;
  }

  if(data.mode === 'layeredMagnifier') {
    return `
      <section class="layered-magnifier-investigation">
        <header class="magnifier-zone-progress">
          <strong>Leitura em camadas</strong>
          <span>Revele as três zonas do artigo antes de interpretar.</span>
        </header>
        <div class="magnifier-zone-list" data-magnifier-zone-list>
          ${data.magnifierZones.map((zone, index) => `
            <article class="magnifier-zone-card${index === 0 ? ' active' : ''}" data-magnifier-zone-card="${index}" ${index === 0 ? '' : 'hidden'}>
              <h3>${this.escapeHTML(zone.label)}</h3>
              <div class="worn-paper worn-paper-magnifier layered-worn-paper" data-worn-paper data-worn-zone="${this.escapeHTML(zone.id)}" tabindex="0" role="button" aria-label="Passe a lupa para revelar ${this.escapeHTML(zone.label)}">
                <div class="worn-cover">
                  <span>Documento desgastado</span>
                  <p>${this.escapeHTML(zone.cover)}</p>
                </div>
                <div class="worn-hidden-text" data-worn-text>${this.escapeHTML(zone.text)}</div>
                <span class="magnifier-cursor" data-magnifier-cursor aria-hidden="true"><img src="assets/lupa.png" alt=""></span>
              </div>
            </article>
          `).join('')}
        </div>
        <nav class="magnifier-zone-nav" aria-label="Navegação pelas zonas do documento">
          <button class="sequential-arrow-button previous" type="button" data-zone-previous aria-label="Área anterior" title="Área anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
          <span data-zone-counter>Área 1 de ${data.magnifierZones.length}</span>
          <button class="sequential-arrow-button next" type="button" data-zone-next aria-label="Próxima área" title="Próxima área"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
          <span class="sequential-complete-stamp" data-zone-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
        </nav>
        <section class="sequential-activity documentary-rounds magnifier-rounds" data-sequential-activity data-sequential-mode="quiz">
          <header class="sequential-progress">
            <span data-round-counter>Rodada 1 de ${data.rounds.length}</span>
            <div class="sequential-progress-track" aria-hidden="true"><i data-round-progress></i></div>
          </header>
          <div class="sequential-stage" data-round-stage></div>
          <nav class="sequential-nav" aria-label="Navegação pelas interpretações">
            <button class="sequential-arrow-button previous" type="button" data-round-previous aria-label="Interpretação anterior" title="Interpretação anterior" disabled><span class="sequential-arrow" aria-hidden="true">⟵</span></button>
            <button class="sequential-arrow-button next" type="button" data-round-next aria-label="Próxima interpretação" title="Próxima interpretação"><span class="sequential-arrow" aria-hidden="true">⟶</span></button>
            <span class="sequential-complete-stamp" data-round-complete hidden><small>Etapa</small><strong>Concluída</strong></span>
          </nav>
        </section>
      </section>
      ${submit('Concluir leitura em camadas')}`;
  }

  if(data.mode === 'fakeNews') {
    return `
      <div class="historical-check">
        <div class="claim-card">
          <strong>Afirmacao em investigacao</strong>
          <p>${this.escapeHTML(data.statement || data.c)}</p>
          <small>Confira se a frase exagera, omite condicoes ou usa uma palavra absoluta.</small>
        </div>
        <div class="source-mini-list">
          ${(data.sources || []).map(source => `<button type="button" class="activity-card source-check-card" data-open-source="${source.id}"><strong>${this.escapeHTML(source.title)}</strong><span>${this.escapeHTML(source.text)}</span><em>Consultar fonte</em></button>`).join('')}
        </div>
        <div class="classification-panel">
          <strong>Depois da consulta, como fica a afirmacao?</strong>
          <div class="choice-row">
            ${data.classifications.map(item => `<button class="mini-action-btn" type="button" data-fake-classification="${this.escapeHTML(item)}">${this.escapeHTML(item)}</button>`).join('')}
          </div>
        </div>
      </div>
      ${submit('Confirmar checagem')}`;
  }

  if(data.mode === 'fakeNewsLegacy') {
    return `
      <div class="claim-card"><strong>Afirmação investigada</strong><p>${this.escapeHTML(data.statement || data.c)}</p></div>
      <div class="source-mini-list">
        ${(data.sources || []).map(source => `<button type="button" class="activity-card" data-open-source="${source.id}"><strong>${this.escapeHTML(source.title)}</strong><span>${this.escapeHTML(source.text)}</span></button>`).join('')}
      </div>
      <div class="choice-row">
        ${data.classifications.map(item => `<button class="mini-action-btn" type="button" data-fake-classification="${this.escapeHTML(item)}">${this.escapeHTML(item)}</button>`).join('')}
      </div>
      ${submit('Confirmar checagem')}`;
  }

  if(data.mode === 'finalDossier') {
    return `
      <div class="final-dossier-builder">
        <section>
          <strong>Tese</strong>
          ${data.thesisOptions.map(item => `<button class="activity-card" type="button" data-thesis="${this.escapeHTML(item)}">${this.escapeHTML(item)}</button>`).join('')}
        </section>
        <section>
          <strong>Evidencias</strong>
          <div class="final-evidence-grid">
            ${data.evidenceBank.map(item => `<button class="activity-card" type="button" data-final-evidence="${this.escapeHTML(item)}">${this.escapeHTML(item)}</button>`).join('')}
          </div>
        </section>
        <section>
          <strong>Limitacao da fonte</strong>
          ${data.limitations.map(item => `<button class="activity-card" type="button" data-limitation="${this.escapeHTML(item)}">${this.escapeHTML(item)}</button>`).join('')}
        </section>
        <label class="final-conclusion-label">Conclusao</label>
        <textarea class="typewriter-input final-conclusion" data-final-conclusion placeholder="Escreva uma conclusao curta relacionando conquista, Muzambinho e limites..."></textarea>
      </div>
      ${submit('Carimbar dossie final')}`;
  }

  return `
    <div class="quiz-options">
      ${data.options.map((opt, index) => `
        <button class="quiz-checkbox-btn" type="button" data-quiz-index="${index}">
          <span class="check-box"></span>
          <span class="option-text">${this.escapeHTML(opt)}</span>
        </button>`).join('')}
    </div>
    ${submit('Confirmar resposta')}`;
};

EvidenceSystem.bindActivity = function(overlay, title, text, data) {
  const state = {
    order: [],
    selected: new Set(),
    answers: {},
    blankWord: null,
    blanks: {},
    headline: [],
    quizIndex: null,
    roundIndex: 0,
    roundAnswers: {},
    magnifierZoneIndex: 0,
    attempts: 0,
    hintsUsed: 0,
    activeWire: null,
    activeLink: null,
    dragLink: null,
    activeAssoc: null,
    restoredRegions: new Set(),
    openedSources: new Set(),
    thesis: '',
    finalEvidence: new Set(),
    limitation: ''
  };
  const feedback = overlay.querySelector('.quiz-feedback');
  const hintBox = overlay.querySelector('.phase-hint-box');

  const showFeedback = (html) => {
    if(feedback) feedback.innerHTML = html;
  };

  const showIncomplete = (message) => {
    showFeedback(`<div class="phase-feedback-note">${this.escapeHTML(message)}</div>`);
  };

  const resetAfterWrong = () => {
    overlay.querySelectorAll('.selected, .answered, .linked, .assoc-selected, .assoc-filled, .assoc-used').forEach(el => el.classList.remove('selected', 'answered', 'linked', 'assoc-selected', 'assoc-filled', 'assoc-used'));
    overlay.querySelectorAll('.check-box').forEach(el => { el.innerHTML = ''; });
    overlay.querySelectorAll('.drop-slot').forEach(slot => {
      slot.dataset.value = '';
      slot.classList.remove('filled');
      slot.innerHTML = `<span>${Number(slot.dataset.slotIndex) + 1}</span><em>Toque ou solte aqui</em>`;
    });
    overlay.querySelectorAll('.drag-card, .word-chip').forEach(el => { el.disabled = false; el.classList.remove('used'); });
    overlay.querySelectorAll('.blank-slot').forEach(slot => { slot.textContent = '_____'; slot.dataset.value = ''; });
    const line = overlay.querySelector('[data-headline-line]');
    if(line) line.innerHTML = '<span>Monte a manchete aqui</span>';
    overlay.querySelectorAll('[data-wire-lines], [data-link-lines]').forEach(svg => svg.replaceChildren());
    overlay.querySelectorAll('[data-worn-paper]').forEach(paper => {
      paper.classList.remove('restored', 'revealing');
      paper.style.removeProperty('--reveal-x');
      paper.style.removeProperty('--reveal-y');
      paper.style.removeProperty('--reveal-mask');
      paper.dataset.revealSamples = '0';
      paper.dataset.revealPoints = '';
    });
    overlay.querySelectorAll('[data-restore-region]').forEach(button => button.classList.remove('used'));
    overlay.querySelectorAll('[data-quote-preview]').forEach(preview => { preview.innerHTML = 'Escolha quem falou'; });
    overlay.querySelectorAll('[data-assoc-drop]').forEach(drop => { drop.innerHTML = '<span>Solte aqui</span>'; });
    state.order = [];
    state.selected.clear();
    state.answers = {};
    state.blanks = {};
    state.headline = [];
    state.blankWord = null;
    state.quizIndex = null;
    state.roundIndex = 0;
    state.roundAnswers = {};
    state.magnifierZoneIndex = 0;
    state.activeWire = null;
    state.activeLink = null;
    state.dragLink = null;
    state.activeAssoc = null;
    state.restoredRegions.clear();
    state.openedSources.clear();
    state.finalEvidence.clear();
    state.thesis = '';
    state.limitation = '';
    if(sequentialActivity) renderSequentialRound();
  };

  const completePhase = ({ isCorrect, selectedAnswer, completedByExplanation = false }) => {
    const score = GameLogic.computePhaseScore(isCorrect, state.attempts || 1, state.hintsUsed, completedByExplanation);
    const answerMeta = {
      phaseNum: data.phaseNum,
      title,
      chapterTitle: data.chapterTitle,
      question: data.q,
      selectedAnswer,
      isCorrect,
      attempts: state.attempts || 1,
      hintsUsed: state.hintsUsed,
      score,
      completedByExplanation,
      completedAt: new Date().toISOString(),
      source: data.source,
      evidenceReward: data.evidenceReward
    };

    GameLogic.recordAnswer(answerMeta);
    GameLogic.recordGameEvent(isCorrect ? 'answer_correct' : 'explanation_opened', data, { attempt: state.attempts || 1, score });
    GameLogic.playSFX('stamp');
    overlay.classList.add(isCorrect ? 'verdict-deferido' : 'verdict-concluido');
    showFeedback(`
      <div class="stamp-correct stamp-animated">${completedByExplanation ? 'ANALISE CONCLUIDA' : 'DEFERIDO'}</div>
    `);
    let chronologyRevealDelay = 0;
    if(isCorrect && data.mode === 'chronology' && Array.isArray(data.revealDates)) {
      const slots = Array.from(overlay.querySelectorAll('.chronology-lane .drop-slot'));
      data.revealDates.forEach((date, index) => {
        const slot = slots[index];
        if(!slot) return;
        const dateTag = document.createElement('time');
        dateTag.className = 'chronology-date-reveal';
        dateTag.textContent = date;
        slot.appendChild(dateTag);
        setTimeout(() => dateTag.classList.add('visible'), 260 + (index * 260));
      });
      chronologyRevealDelay = 700 + (data.revealDates.length * 260);
    }
    GameLogic.addEvidenceToInventory(title, text, answerMeta);
    const unlockInfo = GameLogic.unlockNextPhase(data.phaseNum, { silent: true });
    const isChapterEnd = data.phaseNum === unlockInfo.lastInChapter || data.phaseNum >= unlockInfo.total;
    GameLogic.pendingPhaseAfterDialogue = isChapterEnd
      ? {
          chapterIndex: unlockInfo.currentPhase?.chapterIndex || GameLogic.currentChapterIndex,
          nextChapterIndex: unlockInfo.nextPhase ? unlockInfo.nextPhase.chapterIndex : null
        }
      : null;

    setTimeout(() => {
      document.getElementById('investigationModal')?.remove();
      GameLogic.startDialogue([
        data.correctFeedback || data.feedback || 'Resposta registrada com justificativa histórica.',
        isChapterEnd ? 'Guarde essa explicacao: ela fecha uma parte importante do dossie.' : 'A proxima ficha foi liberada na gaveta.'
      ], 'phase_feedback');
    }, chronologyRevealDelay || 950);
  };

  const finish = (isCorrect, selectedAnswer) => {
    state.attempts += 1;
    GameLogic.recordGameEvent('answer_submitted', data, { attempt: state.attempts, answer: selectedAnswer });

    if(isCorrect) {
      completePhase({ isCorrect: true, selectedAnswer });
      return;
    }

    GameLogic.playSFX('error');
    const canConclude = state.attempts >= 3;
    overlay.classList.remove('verdict-indeferido');
    void overlay.offsetWidth;
    overlay.classList.add('verdict-indeferido');
    showFeedback(`
      <div class="stamp-wrong">INDEFERIDO</div>
      <p class="phase-feedback-text">A Sufragista deixou uma orientação para revisar a leitura.</p>
      ${canConclude ? '<button type="button" class="btn-secondary" data-complete-explanation>Concluir com explicacao</button>' : ''}
    `);
    overlay.querySelector('.investigation-dossier')?.classList.add('shake-error');
    setTimeout(() => overlay.querySelector('.investigation-dossier')?.classList.remove('shake-error'), 450);
    GameLogic.showWrongAnswerHelp({
      ...data,
      hint: data.wrongFeedback || data.hints?.[Math.min(state.attempts - 1, Math.max(0, (data.hints?.length || 1) - 1))] || data.hint,
      curiosity: null
    });
    if(canConclude) {
      feedback.querySelector('[data-complete-explanation]')?.addEventListener('click', () => {
        completePhase({ isCorrect: false, selectedAnswer, completedByExplanation: true });
      });
    } else {
      setTimeout(() => {
        showFeedback('');
        resetAfterWrong();
      }, 1500);
    }
  };

  const clearSlot = (slot) => {
    if(!slot) return;
    const oldId = slot.dataset.value;
    if(oldId) {
      const oldCard = overlay.querySelector(`[data-order-id="${CSS.escape(oldId)}"]`);
      if(oldCard) oldCard.disabled = false;
    }
    state.order[Number(slot.dataset.slotIndex)] = undefined;
    slot.dataset.value = '';
    slot.classList.remove('filled');
    slot.innerHTML = `<span>${Number(slot.dataset.slotIndex) + 1}</span><em>Toque ou solte aqui</em>`;
  };

  const placeOrder = (id, label, slot = null) => {
    const targetSlot = slot || Array.from(overlay.querySelectorAll('.drop-slot')).find(item => !item.dataset.value);
    if(!targetSlot) return;
    const previousSlot = Array.from(overlay.querySelectorAll('.drop-slot')).find(item => item.dataset.value === id);
    if(previousSlot && previousSlot !== targetSlot) clearSlot(previousSlot);
    const replacedId = targetSlot.dataset.value;
    if(replacedId && replacedId !== id) {
      const replacedCard = overlay.querySelector(`[data-order-id="${CSS.escape(replacedId)}"]`);
      if(replacedCard) replacedCard.disabled = false;
      const replacedIndex = state.order.indexOf(replacedId);
      if(replacedIndex >= 0) state.order[replacedIndex] = undefined;
    }
    state.order[Number(targetSlot.dataset.slotIndex)] = id;
    targetSlot.dataset.value = id;
    targetSlot.classList.add('filled');
    targetSlot.innerHTML = `<strong>${Number(targetSlot.dataset.slotIndex) + 1}</strong><span>${this.escapeHTML(label)}</span>`;
    const card = overlay.querySelector(`[data-order-id="${CSS.escape(id)}"]`);
    if(card) card.disabled = true;
  };

  const getLinkPoint = (node, boardRect, side) => {
    const rect = node.getBoundingClientRect();
    return {
      x: (side === 'left' ? rect.right : rect.left) - boardRect.left,
      y: rect.top + (rect.height / 2) - boardRect.top
    };
  };

  const linkPath = (start, end, index = 0, temporary = false) => {
    const bend = Math.max(68, Math.abs(end.x - start.x) * 0.45);
    const c1 = start.x + bend;
    const c2 = end.x - bend;
    return `<path d="M ${start.x} ${start.y} C ${c1} ${start.y}, ${c2} ${end.y}, ${end.x} ${end.y}" class="wire-line link-line link-line-${index % 4}${temporary ? ' link-line-temp' : ''}" marker-end="url(#linkArrow)"></path>`;
  };

  const drawLinkBoard = (board, temporary = null) => {
    const svg = board.querySelector('[data-link-lines]');
    if(!svg) return;
    const boardRect = board.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    const mode = board.dataset.linkMode;
    const defs = `
      <defs>
        <marker id="linkArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" class="link-arrow-head"></path>
        </marker>
      </defs>`;
    const lines = Object.entries(state.answers).map(([id, value], index) => {
      const left = mode === 'quoteMatch'
        ? board.querySelector(`[data-link-left="${CSS.escape(value)}"]`)
        : board.querySelector(`[data-link-left="${CSS.escape(id)}"]`);
      const right = mode === 'quoteMatch'
        ? board.querySelector(`[data-link-right="${CSS.escape(id)}"]`)
        : Array.from(board.querySelectorAll('[data-link-right]')).find(node => node.dataset.linkValue === value);
      if(!left || !right) return '';
      return linkPath(getLinkPoint(left, boardRect, 'left'), getLinkPoint(right, boardRect, 'right'), index);
    });

    if(temporary && temporary.board === board) {
      const left = board.querySelector(`[data-link-left="${CSS.escape(temporary.leftId)}"]`);
      if(left) lines.push(linkPath(getLinkPoint(left, boardRect, 'left'), { x: temporary.x, y: temporary.y }, lines.length, true));
    }

    svg.innerHTML = defs + lines.join('');
  };

  const refreshLinkBoard = (board) => {
    if(!board) return;
    const mode = board.dataset.linkMode;
    board.querySelectorAll('[data-link-left], [data-link-right]').forEach(node => node.classList.remove('selected', 'answered', 'linked'));
    Object.entries(state.answers).forEach(([id, value]) => {
      const left = mode === 'quoteMatch'
        ? board.querySelector(`[data-link-left="${CSS.escape(value)}"]`)
        : board.querySelector(`[data-link-left="${CSS.escape(id)}"]`);
      const right = mode === 'quoteMatch'
        ? board.querySelector(`[data-link-right="${CSS.escape(id)}"]`)
        : Array.from(board.querySelectorAll('[data-link-right]')).find(node => node.dataset.linkValue === value);
      left?.classList.add('answered', 'linked');
      right?.classList.add('answered', 'linked');
    });
    if(state.activeLink?.board === board) state.activeLink.left?.classList.add('selected');
    drawLinkBoard(board, state.dragLink);
  };

  const refreshAllLinkBoards = () => overlay.querySelectorAll('[data-link-board]').forEach(board => refreshLinkBoard(board));

  const connectLinkNodes = (left, right) => {
    const board = left.closest('[data-link-board]');
    if(!board || right.closest('[data-link-board]') !== board) return;
    const mode = board.dataset.linkMode;
    const answerKey = mode === 'quoteMatch' ? right.dataset.linkRight : left.dataset.linkLeft;
    const answerValue = mode === 'quoteMatch' ? left.dataset.linkValue : right.dataset.linkValue;

    Object.keys(state.answers).forEach(key => {
      if(key !== answerKey && state.answers[key] === answerValue) delete state.answers[key];
    });
    state.answers[answerKey] = answerValue;
    state.activeLink = null;
    state.dragLink = null;
    showFeedback('');
    refreshAllLinkBoards();
  };

  const resizeWireBoard = () => {
    if(!document.body.contains(overlay)) {
      window.removeEventListener('resize', resizeWireBoard);
      return;
    }
    refreshAllLinkBoards();
  };
  window.addEventListener('resize', resizeWireBoard, { passive: true });

  const revealWornPaper = (paper, event = null, force = false) => {
    if(!paper) return;
    const rect = paper.getBoundingClientRect();
    const pointer = event?.touches?.[0] || event;
    const rawX = pointer ? pointer.clientX - rect.left : rect.width / 2;
    const rawY = pointer ? pointer.clientY - rect.top : rect.height / 2;
    const x = Math.max(0, Math.min(rect.width, rawX));
    const y = Math.max(0, Math.min(rect.height, rawY));

    paper.style.setProperty('--reveal-x', `${x}px`);
    paper.style.setProperty('--reveal-y', `${y}px`);
    paper.classList.add('revealing');
    const samples = force ? 18 : Math.min(18, Number(paper.dataset.revealSamples || 0) + 1);
    paper.dataset.revealSamples = String(samples);
    const centerPoints = [
      [x, y],
      [x - 48, y],
      [x + 48, y],
      [x, y - 34],
      [x, y + 34]
    ];
    const previousPoints = (paper.dataset.revealPoints || '')
      .split('|')
      .filter(Boolean)
      .map(point => point.split(':').map(Number));
    const nextPoints = (force ? previousPoints.concat(centerPoints) : previousPoints.concat([[x, y]])).slice(-34);
    const compactPoints = nextPoints.map(([px, py]) => `${Math.round(px)}:${Math.round(py)}`);
    paper.dataset.revealPoints = compactPoints.join('|');
    paper.style.setProperty('--reveal-mask', nextPoints.map(([px, py]) => `radial-gradient(circle 54px at ${Math.round(px)}px ${Math.round(py)}px, #000 0 68%, rgba(0,0,0,0.65) 74%, transparent 100%)`).join(', '));
    if(samples >= 10) {
      paper.classList.add('restored');
      state.restoredRegions.add(paper.dataset.wornZone || 'full');
    }
  };

  overlay.querySelectorAll('[data-source-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.sourceTab;
      overlay.querySelectorAll('[data-source-tab]').forEach(item => item.classList.toggle('active', item === button));
      overlay.querySelectorAll('[data-source-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.sourcePanel === tab));
      GameLogic.recordGameEvent(tab === 'document' ? 'document_opened' : 'source_opened', data, { panel: tab });
    });
  });

  overlay.querySelector('[data-reset-activity]')?.addEventListener('click', () => {
    resetAfterWrong();
    showFeedback('');
  });

  overlay.querySelectorAll('[data-order-id]').forEach(button => {
    button.addEventListener('click', () => placeOrder(button.dataset.orderId, button.dataset.orderLabel || button.innerText.trim()));
    button.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', button.dataset.orderId));
  });

  overlay.querySelectorAll('.drop-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const selected = Array.from(overlay.querySelectorAll('[data-order-id]')).find(card => !card.disabled);
      if(selected) placeOrder(selected.dataset.orderId, selected.dataset.orderLabel || selected.innerText.trim(), slot);
    });
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain');
      const card = overlay.querySelector(`[data-order-id="${CSS.escape(id)}"]`);
      if(card) placeOrder(id, card.dataset.orderLabel || card.innerText.trim(), slot);
    });
  });

  overlay.querySelectorAll('[data-quiz-index]').forEach(button => {
    button.addEventListener('click', () => {
      state.quizIndex = Number(button.dataset.quizIndex);
      overlay.querySelectorAll('[data-quiz-index]').forEach(btn => {
        btn.classList.remove('selected');
        const box = btn.querySelector('.check-box');
        if(box) box.innerHTML = '';
      });
      button.classList.add('selected');
      button.querySelector('.check-box').innerHTML = '<span style="font-weight:900; color:var(--wine);">X</span>';
    });
  });

  const sequentialActivity = overlay.querySelector('[data-sequential-activity]');
  const renderSequentialRound = () => {
    if(!sequentialActivity) return;
    const isInterview = sequentialActivity.dataset.sequentialMode === 'interview';
    const items = isInterview ? data.interviews : data.rounds;
    const item = items[state.roundIndex];
    const selectedIndex = state.roundAnswers[state.roundIndex];
    const stage = sequentialActivity.querySelector('[data-round-stage]');
    const counter = sequentialActivity.querySelector('[data-round-counter]');
    const progress = sequentialActivity.querySelector('[data-round-progress]');
    const options = isInterview ? data.categories : item.options;

    const roundNoun = isInterview ? 'Entrevista' : (data.mode === 'restoreInvestigation' ? 'Questão' : 'Rodada');
    counter.textContent = `${roundNoun} ${state.roundIndex + 1} de ${items.length}`;
    progress.style.width = `${((state.roundIndex + 1) / items.length) * 100}%`;
    stage.innerHTML = isInterview
      ? `<article class="interview-file">
          <header><span>Depoimento ${state.roundIndex + 1}</span><h3>${EvidenceSystem.escapeHTML(item.name)}</h3></header>
          <blockquote>“${EvidenceSystem.escapeHTML(item.profile)}”</blockquote>
          <p class="interview-instruction">Qual é a situação de ${EvidenceSystem.escapeHTML(item.name)} diante do Código de 1932?</p>
          <div class="quiz-options sequential-options">
            ${options.map((option, index) => `<button class="quiz-checkbox-btn${selectedIndex === index ? ' selected' : ''}" type="button" data-round-option="${index}"><span class="check-box">${selectedIndex === index ? '<b>X</b>' : ''}</span><span class="option-text">${EvidenceSystem.escapeHTML(option)}</span></button>`).join('')}
          </div>
          ${selectedIndex !== undefined ? `<aside class="round-rationale"><strong>Critério histórico</strong><p>${EvidenceSystem.escapeHTML(item.reason)}</p></aside>` : ''}
        </article>`
      : `<article class="documentary-round">
          <header><span>Questão documental ${state.roundIndex + 1}</span><h3>${EvidenceSystem.escapeHTML(item.title)}</h3></header>
          <p class="documentary-round-question">${EvidenceSystem.escapeHTML(item.question)}</p>
          <div class="quiz-options sequential-options">
            ${options.map((option, index) => `<button class="quiz-checkbox-btn${selectedIndex === index ? ' selected' : ''}" type="button" data-round-option="${index}"><span class="check-box">${selectedIndex === index ? '<b>X</b>' : ''}</span><span class="option-text"><b>${String.fromCharCode(65 + index)})</b> ${EvidenceSystem.escapeHTML(option)}</span></button>`).join('')}
          </div>
        </article>`;

    sequentialActivity.querySelector('[data-round-previous]').disabled = state.roundIndex === 0;
    const nextButton = sequentialActivity.querySelector('[data-round-next]');
    const completeStamp = sequentialActivity.querySelector('[data-round-complete]');
    const atLastRound = state.roundIndex >= items.length - 1;
    const finalRoundAnswered = atLastRound && state.roundAnswers[state.roundIndex] !== undefined;
    nextButton.hidden = atLastRound;
    nextButton.disabled = atLastRound;
    if(completeStamp) completeStamp.hidden = !finalRoundAnswered;
    const nextLabel = isInterview
      ? 'Próxima entrevista'
      : (data.mode === 'headlineInvestigation'
        ? 'Próxima análise'
        : (data.mode === 'layeredMagnifier'
          ? 'Próxima interpretação'
          : (data.mode === 'restoreInvestigation' ? 'Próxima questão' : 'Próxima rodada')));
    nextButton.setAttribute('aria-label', nextLabel);
    nextButton.title = nextLabel;
    nextButton.innerHTML = '<span class="sequential-arrow" aria-hidden="true">⟶</span>';

    stage.querySelectorAll('[data-round-option]').forEach(button => {
      button.addEventListener('click', () => {
        state.roundAnswers[state.roundIndex] = Number(button.dataset.roundOption);
        showFeedback('');
        renderSequentialRound();
      });
    });
  };

  if(sequentialActivity) {
    sequentialActivity.querySelector('[data-round-previous]').addEventListener('click', () => {
      state.roundIndex = Math.max(0, state.roundIndex - 1);
      renderSequentialRound();
    });
    sequentialActivity.querySelector('[data-round-next]').addEventListener('click', () => {
      const items = sequentialActivity.dataset.sequentialMode === 'interview' ? data.interviews : data.rounds;
      if(state.roundAnswers[state.roundIndex] === undefined) return showIncomplete('Escolha uma resposta antes de avançar.');
      state.roundIndex = Math.min(items.length - 1, state.roundIndex + 1);
      showFeedback('');
      renderSequentialRound();
    });
    renderSequentialRound();
  }

  const magnifierZoneCards = Array.from(overlay.querySelectorAll('[data-magnifier-zone-card]'));
  const renderMagnifierZone = () => {
    if(!magnifierZoneCards.length) return;
    magnifierZoneCards.forEach((card, index) => {
      const active = index === state.magnifierZoneIndex;
      card.hidden = !active;
      card.classList.toggle('active', active);
    });
    const counter = overlay.querySelector('[data-zone-counter]');
    if(counter) counter.textContent = `Área ${state.magnifierZoneIndex + 1} de ${magnifierZoneCards.length}`;
    const previous = overlay.querySelector('[data-zone-previous]');
    const next = overlay.querySelector('[data-zone-next]');
    const completeStamp = overlay.querySelector('[data-zone-complete]');
    if(previous) previous.disabled = state.magnifierZoneIndex === 0;
    if(next) {
      const atEnd = state.magnifierZoneIndex >= magnifierZoneCards.length - 1;
      const finalZone = data.magnifierZones?.[state.magnifierZoneIndex];
      const documentRevealed = atEnd && finalZone && state.restoredRegions.has(finalZone.id);
      next.hidden = atEnd;
      next.disabled = atEnd;
      next.setAttribute('aria-label', 'Próxima área');
      next.title = 'Próxima área';
      next.innerHTML = '<span class="sequential-arrow" aria-hidden="true">⟶</span>';
      if(completeStamp) completeStamp.hidden = !documentRevealed;
    }
  };

  overlay.querySelector('[data-zone-previous]')?.addEventListener('click', () => {
    state.magnifierZoneIndex = Math.max(0, state.magnifierZoneIndex - 1);
    renderMagnifierZone();
  });

  overlay.querySelector('[data-zone-next]')?.addEventListener('click', () => {
    const zone = data.magnifierZones?.[state.magnifierZoneIndex];
    if(zone && !state.restoredRegions.has(zone.id)) return showIncomplete('Revele esta área com a lupa antes de avançar.');
    state.magnifierZoneIndex = Math.min(magnifierZoneCards.length - 1, state.magnifierZoneIndex + 1);
    showFeedback('');
    renderMagnifierZone();
  });

  renderMagnifierZone();

  let marking = false;
  const markToken = (button) => {
    if(state.selected.has(button.dataset.tokenId)) {
      state.selected.delete(button.dataset.tokenId);
      button.classList.remove('selected');
      return;
    }
    state.selected.add(button.dataset.tokenId);
    button.classList.add('selected');
  };
  overlay.querySelectorAll('.mark-token').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      marking = true;
      markToken(button);
      document.addEventListener('pointerup', () => { marking = false; }, { once: true });
    });
    button.addEventListener('pointerenter', () => {
      if(marking && !button.classList.contains('selected')) markToken(button);
    });
  });

  overlay.querySelectorAll('[data-highlight-id]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.highlightId;
      if(state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      button.classList.toggle('selected');
    });
  });

  const renderAssociationChip = (game, value) => {
    if(game.dataset.assocMode === 'quoteMatch') {
      const person = (data.people || []).find(item => item.id === value) || { id: value, name: value };
      return `${EvidenceSystem.renderPersonPortrait(person, 'tiny')}<strong>${EvidenceSystem.escapeHTML(person.name)}</strong>`;
    }
    if(game.dataset.assocMode === 'connections' && data.impacts) {
      const impact = data.impacts.find(item => item.id === value);
      if(impact) return `<strong>${EvidenceSystem.escapeHTML(impact.title)}</strong>`;
    }
    return `<strong>${EvidenceSystem.escapeHTML(value)}</strong>`;
  };

  const refreshAssociationGame = (game) => {
    if(!game) return;
    game.querySelectorAll('[data-assoc-drop]').forEach(drop => {
      const value = state.answers[drop.dataset.assocDrop];
      drop.innerHTML = value ? renderAssociationChip(game, value) : '<span>Solte aqui</span>';
      drop.classList.toggle('assoc-filled', Boolean(value));
      drop.closest('[data-assoc-target]')?.classList.toggle('assoc-filled', Boolean(value));
    });
    game.querySelectorAll('[data-assoc-token]').forEach(token => {
      const used = Object.values(state.answers).includes(token.dataset.assocToken);
      const active = state.activeAssoc?.game === game && state.activeAssoc.value === token.dataset.assocToken;
      token.classList.toggle('assoc-used', used);
      token.classList.toggle('assoc-selected', active);
    });
  };

  const refreshAllAssociationGames = () => overlay.querySelectorAll('[data-assoc-game]').forEach(game => refreshAssociationGame(game));

  const assignAssociation = (game, targetId, value) => {
    if(!game || !targetId || !value) return;
    Object.keys(state.answers).forEach(key => {
      if(key !== targetId && state.answers[key] === value) delete state.answers[key];
    });
    state.answers[targetId] = value;
    state.activeAssoc = null;
    showFeedback('');
    refreshAllAssociationGames();
  };

  overlay.querySelectorAll('[data-assoc-token]').forEach(token => {
    token.addEventListener('click', () => {
      state.activeAssoc = {
        game: token.closest('[data-assoc-game]'),
        value: token.dataset.assocToken
      };
      refreshAllAssociationGames();
    });
    token.addEventListener('dragstart', event => {
      state.activeAssoc = {
        game: token.closest('[data-assoc-game]'),
        value: token.dataset.assocToken
      };
      event.dataTransfer.setData('text/plain', token.dataset.assocToken);
      event.dataTransfer.effectAllowed = 'move';
      token.classList.add('assoc-selected');
    });
    token.addEventListener('dragend', () => {
      refreshAllAssociationGames();
    });
  });

  overlay.querySelectorAll('[data-assoc-target], [data-assoc-drop]').forEach(target => {
    target.addEventListener('dragover', event => {
      event.preventDefault();
      target.closest('[data-assoc-target]')?.classList.add('assoc-hover');
    });
    target.addEventListener('dragleave', () => {
      target.closest('[data-assoc-target]')?.classList.remove('assoc-hover');
    });
    target.addEventListener('drop', event => {
      event.preventDefault();
      const card = target.closest('[data-assoc-target]');
      const game = target.closest('[data-assoc-game]');
      const value = event.dataTransfer.getData('text/plain') || state.activeAssoc?.value;
      card?.classList.remove('assoc-hover');
      assignAssociation(game, card?.dataset.assocTarget, value);
    });
  });

  overlay.querySelectorAll('[data-assoc-drop]').forEach(drop => {
    drop.addEventListener('click', () => {
      const game = drop.closest('[data-assoc-game]');
      if(state.activeAssoc?.game === game) assignAssociation(game, drop.dataset.assocDrop, state.activeAssoc.value);
      else showIncomplete('Escolha uma ficha de cima e encaixe aqui.');
    });
  });

  const moveLinkDrag = (event) => {
    if(!state.dragLink) return;
    if(!document.body.contains(overlay)) {
      document.removeEventListener('pointermove', moveLinkDrag);
      document.removeEventListener('pointerup', endLinkDrag);
      return;
    }
    const rect = state.dragLink.board.getBoundingClientRect();
    state.dragLink.x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    state.dragLink.y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    drawLinkBoard(state.dragLink.board, state.dragLink);
  };

  function endLinkDrag(event) {
    if(!state.dragLink) return;
    const drag = state.dragLink;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-link-right]');
    if(target && target.closest('[data-link-board]') === drag.board) {
      connectLinkNodes(drag.left, target);
    } else {
      state.dragLink = null;
      refreshLinkBoard(drag.board);
    }
    document.removeEventListener('pointermove', moveLinkDrag);
    document.removeEventListener('pointerup', endLinkDrag);
  }

  overlay.querySelectorAll('[data-link-left]').forEach(left => {
    left.addEventListener('pointerdown', event => {
      event.preventDefault();
      const board = left.closest('[data-link-board]');
      const rect = board.getBoundingClientRect();
      state.activeLink = { board, left };
      state.dragLink = {
        board,
        left,
        leftId: left.dataset.linkLeft,
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
      };
      left.setPointerCapture?.(event.pointerId);
      refreshLinkBoard(board);
      document.addEventListener('pointermove', moveLinkDrag);
      document.addEventListener('pointerup', endLinkDrag);
    });
  });

  overlay.querySelectorAll('[data-link-right]').forEach(right => {
    right.addEventListener('click', () => {
      if(state.activeLink?.board === right.closest('[data-link-board]')) connectLinkNodes(state.activeLink.left, right);
    });
  });

  overlay.querySelectorAll('[data-statement-id], [data-pair-id], [data-quote-id]').forEach(card => {
    card.querySelectorAll('[data-value]').forEach(button => {
      button.addEventListener('click', () => {
        const id = card.dataset.statementId || card.dataset.pairId || card.dataset.quoteId;
        state.answers[id] = button.dataset.value;
        card.classList.add('answered');
        card.querySelectorAll('[data-value]').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        if(card.dataset.quoteId) {
          const selectedPerson = (data.people || []).find(person => person.id === button.dataset.value);
          const preview = card.querySelector('[data-quote-preview]');
          if(selectedPerson && preview) {
            preview.innerHTML = `${EvidenceSystem.renderPersonPortrait(selectedPerson, 'small')}<strong>${EvidenceSystem.escapeHTML(selectedPerson.name)}</strong>`;
          }
        }
      });
    });
  });

  overlay.querySelectorAll('[data-wire-clue]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeWire = button.dataset.wireClue;
      overlay.querySelectorAll('[data-wire-clue]').forEach(item => item.classList.toggle('selected', item === button));
    });
  });

  overlay.querySelectorAll('[data-wire-option]').forEach(button => {
    button.addEventListener('click', () => {
      if(!state.activeWire) {
        showIncomplete('Escolha primeiro uma pista da coluna esquerda.');
        return;
      }

      state.answers[state.activeWire] = button.dataset.wireOption;
      const clue = overlay.querySelector(`[data-wire-clue="${CSS.escape(state.activeWire)}"]`);
      if(clue) clue.classList.add('answered');
      overlay.querySelectorAll('[data-wire-option]').forEach(item => {
        const isUsed = Object.values(state.answers).includes(item.dataset.wireOption);
        item.classList.toggle('answered', isUsed);
        item.classList.toggle('selected', isUsed);
      });
      state.activeWire = null;
      overlay.querySelectorAll('[data-wire-clue]').forEach(item => item.classList.remove('selected'));
      refreshAllLinkBoards();
    });
  });

  overlay.querySelectorAll('.word-chip').forEach(button => {
    button.addEventListener('click', () => {
      if(overlay.querySelector('[data-headline-line]')) {
        state.headline.push(button.dataset.word);
        button.disabled = true;
        button.classList.add('used');
        overlay.querySelector('[data-headline-line]').innerHTML = state.headline.map(word => `<strong>${this.escapeHTML(word)}</strong>`).join(' ');
        return;
      }
      state.blankWord = button.dataset.word;
      overlay.querySelectorAll('.word-chip').forEach(chip => chip.classList.remove('selected'));
      button.classList.add('selected');
    });
    button.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', button.dataset.word));
  });

  overlay.querySelectorAll('.blank-slot').forEach(slot => {
    const assign = (word) => {
      if(!word) return;
      slot.textContent = word;
      slot.dataset.value = word;
      state.blanks[slot.dataset.blankId] = word;
    };
    slot.addEventListener('click', () => assign(state.blankWord));
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => {
      event.preventDefault();
      assign(event.dataTransfer.getData('text/plain'));
    });
  });

  overlay.querySelectorAll('[data-booth-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.answers.booth = button.dataset.correct === 'true' ? 'correct' : button.innerText.trim();
      overlay.querySelectorAll('[data-booth-id]').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  overlay.querySelectorAll('[data-restore-region]').forEach(button => {
    button.addEventListener('click', () => {
      state.restoredRegions.add(button.dataset.restoreRegion);
      button.classList.add('selected');
      button.classList.add('used');
      const textPanel = overlay.querySelector('[data-worn-text]');
      if(textPanel) textPanel.hidden = false;
      const paper = overlay.querySelector('[data-worn-paper]');
      if(paper) paper.classList.add('restored');
    });
  });

  overlay.querySelectorAll('[data-worn-paper]').forEach(paper => {
    paper.addEventListener('pointerdown', event => {
      event.preventDefault();
      paper.setPointerCapture?.(event.pointerId);
      revealWornPaper(paper, event);
    });
    paper.addEventListener('pointermove', event => {
      if(event.pointerType === 'mouse' || event.buttons || paper.classList.contains('revealing')) {
        revealWornPaper(paper, event);
        renderMagnifierZone();
      }
    });
    paper.addEventListener('pointerleave', () => {
      paper.classList.remove('revealing');
    });
    paper.addEventListener('keydown', event => {
      if(event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        revealWornPaper(paper, null, true);
        renderMagnifierZone();
      }
    });
  });

  overlay.querySelectorAll('[data-open-source]').forEach(button => {
    button.addEventListener('click', () => {
      state.openedSources.add(button.dataset.openSource);
      button.classList.add('selected');
      GameLogic.recordGameEvent('source_opened', data, { sourceId: button.dataset.openSource });
    });
  });

  overlay.querySelectorAll('[data-fake-classification]').forEach(button => {
    button.addEventListener('click', () => {
      state.answers.fakeNews = button.dataset.fakeClassification;
      overlay.querySelectorAll('[data-fake-classification]').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  overlay.querySelectorAll('[data-thesis]').forEach(button => {
    button.addEventListener('click', () => {
      state.thesis = button.dataset.thesis;
      overlay.querySelectorAll('[data-thesis]').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  overlay.querySelectorAll('[data-final-evidence]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.finalEvidence;
      if(state.finalEvidence.has(value)) state.finalEvidence.delete(value);
      else state.finalEvidence.add(value);
      button.classList.toggle('selected');
    });
  });

  overlay.querySelectorAll('[data-limitation]').forEach(button => {
    button.addEventListener('click', () => {
      state.limitation = button.dataset.limitation;
      overlay.querySelectorAll('[data-limitation]').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  overlay.querySelector('[data-submit-activity]')?.addEventListener('click', () => {
    if(data.mode === 'chronology' || data.mode === 'rightsStack') {
      const selectedOrder = state.order.filter(Boolean);
      if(selectedOrder.length !== data.correctOrder.length) return showIncomplete('Ainda ha espacos sem ficha.');
      finish(selectedOrder.join('|') === data.correctOrder.join('|'), selectedOrder.join(' -> '));
    } else if(data.mode === 'textHighlight') {
      const result = this.gradeTextHighlight(overlay, data);
      finish(result.isCorrect, result.selectedAnswer);
    } else if(data.mode === 'quoteMatch') {
      const complete = data.quotes.every(item => state.answers[item.id]);
      if(!complete) return showIncomplete('Associe todas as estratégias antes de confirmar.');
      if(data.closingQuestion && state.quizIndex === null) return showIncomplete('Responda também à pergunta de fechamento.');
      const associationsCorrect = data.quotes.every(item => state.answers[item.id] === item.answer);
      const closingCorrect = !data.closingQuestion || state.quizIndex === data.closingQuestion.correctIndex;
      const associationAnswer = data.quotes.map(item => `${item.title || item.text}: ${state.answers[item.id]}`).join(' | ');
      const closingAnswer = data.closingQuestion ? ` | Conclusão: ${data.closingQuestion.options[state.quizIndex]}` : '';
      finish(associationsCorrect && closingCorrect, associationAnswer + closingAnswer);
    } else if(data.mode === 'restoreText') {
      const complete = data.blanks.every(blank => state.blanks[blank.id]);
      if(!complete) return showIncomplete('Complete todas as lacunas antes de confirmar.');
      finish(data.blanks.every(blank => state.blanks[blank.id] === blank.answer), data.blanks.map(blank => `${blank.id}: ${state.blanks[blank.id]}`).join(' | '));
    } else if(data.mode === 'restoreInvestigation') {
      const completeBlanks = data.blanks.every(blank => state.blanks[blank.id]);
      if(!completeBlanks) return showIncomplete('Complete todas as lacunas antes de concluir a análise.');
      if(data.rounds.some((_, index) => state.roundAnswers[index] === undefined)) return showIncomplete('Responda às duas questões de interpretação.');
      const blanksCorrect = data.blanks.every(blank => state.blanks[blank.id] === blank.answer);
      const roundsCorrect = data.rounds.every((round, index) => state.roundAnswers[index] === round.correctIndex);
      const selectedAnswer = `Restauração: ${data.blanks.map(blank => `${blank.id}: ${state.blanks[blank.id]}`).join(' | ')} | ${data.rounds.map((round, index) => `Questão ${index + 1}: ${round.options[state.roundAnswers[index]]}`).join(' | ')}`;
      finish(blanksCorrect && roundsCorrect, selectedAnswer);
    } else if(data.mode === 'votingBooth') {
      if(!state.answers.booth) return showIncomplete('Escolha uma decisao da cabine.');
      finish(state.answers.booth === 'correct', state.answers.booth);
    } else if(data.mode === 'multiRoundQuiz') {
      if(data.rounds.some((_, index) => state.roundAnswers[index] === undefined)) return showIncomplete('Responda às quatro rodadas antes de carimbar a análise.');
      const isCorrect = data.rounds.every((round, index) => state.roundAnswers[index] === round.correctIndex);
      const selectedAnswer = data.rounds.map((round, index) => `Rodada ${index + 1}: ${round.options[state.roundAnswers[index]]}`).join(' | ');
      finish(isCorrect, selectedAnswer);
    } else if(data.mode === 'interviewBooth') {
      if(data.interviews.some((_, index) => state.roundAnswers[index] === undefined)) return showIncomplete('Decida os quatro depoimentos antes de concluir a cabine.');
      const isCorrect = data.interviews.every((interview, index) => state.roundAnswers[index] === interview.correctIndex);
      const selectedAnswer = data.interviews.map((interview, index) => `${interview.name}: ${data.categories[state.roundAnswers[index]]}`).join(' | ');
      finish(isCorrect, selectedAnswer);
    } else if(data.mode === 'headlineOrder') {
      if(state.headline.length !== data.correctOrder.length) return showIncomplete('Monte a manchete completa antes de confirmar.');
      finish(state.headline.join('|') === data.correctOrder.join('|'), state.headline.join(' '));
    } else if(data.mode === 'headlineInvestigation') {
      if(state.headline.length !== data.correctOrder.length) return showIncomplete('Monte o título completo antes de concluir a investigação.');
      if(data.rounds.some((_, index) => state.roundAnswers[index] === undefined)) return showIncomplete('Responda às duas análises do fragmento antes de concluir.');
      const headlineCorrect = state.headline.join('|') === data.correctOrder.join('|');
      const roundsCorrect = data.rounds.every((round, index) => state.roundAnswers[index] === round.correctIndex);
      const selectedAnswer = `Título: ${state.headline.join(' ')} | ${data.rounds.map((round, index) => `Rodada ${index + 1}: ${round.options[state.roundAnswers[index]]}`).join(' | ')}`;
      finish(headlineCorrect && roundsCorrect, selectedAnswer);
    } else if(data.mode === 'wireBoard' || data.mode === 'connections') {
      const complete = data.pairs.every(item => state.answers[item.id]);
      if(!complete) return showIncomplete('Ligue todas as pistas antes de confirmar.');
      if(data.closingQuestion && state.quizIndex === null) return showIncomplete('Responda também à pergunta de leitura crítica.');
      const associationsCorrect = data.pairs.every(item => state.answers[item.id] === item.answer);
      const closingCorrect = !data.closingQuestion || state.quizIndex === data.closingQuestion.correctIndex;
      const associationAnswer = data.pairs.map(item => `${item.clue}: ${state.answers[item.id]}`).join(' | ');
      const closingAnswer = data.closingQuestion ? ` | Conclusão: ${data.closingQuestion.options[state.quizIndex]}` : '';
      finish(associationsCorrect && closingCorrect, associationAnswer + closingAnswer);
    } else if(data.mode === 'factOpinion') {
      const complete = data.statements.every(item => state.answers[item.id]);
      if(!complete) return showIncomplete('Classifique todas as frases antes de confirmar.');
      finish(complete && data.statements.every(item => state.answers[item.id] === item.answer), data.statements.map(item => `${item.text}: ${state.answers[item.id]}`).join(' | '));
    } else if(data.mode === 'highlight') {
      const correctIds = data.snippets.filter(item => item.important).map(item => item.id).sort();
      const selectedIds = Array.from(state.selected).sort();
      if(!selectedIds.length) return showIncomplete('Selecione pelo menos um trecho.');
      finish(correctIds.join('|') === selectedIds.join('|'), selectedIds.map(id => data.snippets.find(item => item.id === id)?.text || id).join(' | '));
    } else if(data.mode === 'wornDocument') {
      if(state.restoredRegions.size === 0) return showIncomplete('Restaure ao menos uma area do documento antes de interpretar.');
      if(state.quizIndex === null) return showIncomplete('Escolha uma interpretacao.');
      finish(state.quizIndex === data.correctIndex, data.options[state.quizIndex]);
    } else if(data.mode === 'layeredMagnifier') {
      if(data.magnifierZones.some(zone => !state.restoredRegions.has(zone.id))) return showIncomplete('Revele as três zonas do documento com a lupa antes de concluir.');
      if(data.rounds.some((_, index) => state.roundAnswers[index] === undefined)) return showIncomplete('Responda às três interpretações do documento.');
      const isCorrect = data.rounds.every((round, index) => state.roundAnswers[index] === round.correctIndex);
      const selectedAnswer = data.rounds.map((round, index) => `Rodada ${index + 1}: ${round.options[state.roundAnswers[index]]}`).join(' | ');
      finish(isCorrect, selectedAnswer);
    } else if(data.mode === 'fakeNews') {
      if(state.openedSources.size === 0) return showIncomplete('Abra pelo menos uma fonte antes de classificar.');
      if(!state.answers.fakeNews) return showIncomplete('Escolha uma classificacao.');
      finish(state.answers.fakeNews === data.correctClassification, state.answers.fakeNews);
    } else if(data.mode === 'finalDossier') {
      const conclusion = overlay.querySelector('[data-final-conclusion]')?.value.trim() || '';
      if(!state.thesis) return showIncomplete('Escolha uma tese para o dossie.');
      if(state.finalEvidence.size < 5) return showIncomplete('Selecione pelo menos cinco evidencias.');
      if(!state.limitation) return showIncomplete('Reconheca uma limitacao da fonte.');
      if(conclusion.length < 40) return showIncomplete('Escreva uma conclusao um pouco mais completa.');
      finish(true, `Tese: ${state.thesis} | Evidencias: ${Array.from(state.finalEvidence).join(', ')} | Limitacao: ${state.limitation} | Conclusao: ${conclusion}`);
    } else {
      if(state.quizIndex === null) return showIncomplete('Selecione uma alternativa antes de confirmar.');
      finish(state.quizIndex === data.correctIndex, data.options[state.quizIndex]);
    }
  });
};

GameLogic.finalEndingVersion = 'final-letter-20260811c';

GameLogic.isGameFinished = function() {
  const total = this.getPhaseList().length;
  return Boolean(this.progress?.unlockedPhases?.includes(total + 1));
};

GameLogic.getPlayerDisplayName = function() {
  return this.user?.fullName || this.user?.name || 'investigadora';
};

GameLogic.getEndingBackdropMarkup = function() {
  return `
    <div class="ending-backdrop-details" aria-hidden="true">
      <figure class="ending-polaroid ending-polaroid-vote">
        <img src="assets/mulheres_voto.jpg" alt="">
        <figcaption>O primeiro voto • 1933</figcaption>
      </figure>
      <figure class="ending-polaroid ending-polaroid-queue">
        <img src="assets/mulheres_nas_urnas.webp" alt="">
        <figcaption>Eleitoras • Rio de Janeiro</figcaption>
      </figure>
      <figure class="ending-polaroid ending-polaroid-carlota">
        <img src="assets/carlota.jpg" alt="">
        <figcaption>Carlota • Constituinte</figcaption>
      </figure>
      <figure class="ending-polaroid ending-polaroid-map">
        <img src="assets/muzambinho.webp" alt="">
        <figcaption>Muzambinho • Minas Gerais</figcaption>
      </figure>
      <span class="ending-backdrop-postmark">Arquivo Central<br>Muzambinho • 1933</span>
      <span class="ending-backdrop-reference">REF. 004/33</span>
      <span class="ending-backdrop-caption">Memória • Cidadania • História</span>
      <span class="ending-document-date ending-document-date-one">24 • FEV • 1932</span>
      <span class="ending-document-date ending-document-date-two">03 • MAI • 1933</span>
      <span class="ending-document-name ending-document-name-one">Bertha Lutz</span>
      <span class="ending-document-name ending-document-name-two">Carlota Pereira de Queirós</span>
      <span class="ending-document-stamp ending-document-stamp-one">Voto<br>feminino</span>
      <span class="ending-document-stamp ending-document-stamp-two">Memória<br>preservada</span>
    </div>
  `;
};

GameLogic.persistFinalFlag = function(key, value = this.finalEndingVersion) {
  if(!this.progress) return;
  this.progress[key] = value;
  this.saveGameProgress();
};

GameLogic.getFinalLetterParagraphs = function() {
  return [
    'Uma lei abriu a porta, mas foram mulheres, ao longo de décadas, que a empurraram até que ela finalmente cedesse.',
    'Antes de o voto feminino ser reconhecido pelo Código Eleitoral de 1932, essa conquista já vinha sendo disputada em jornais, associações, petições, manifestações e outros espaços públicos. Mulheres questionaram uma sociedade que as considerava cidadãs em tantos aspectos, mas ainda resistia à ideia de vê-las participando das decisões políticas.',
    'Em 1933, quando mulheres chegaram às urnas também em Muzambinho, elas não estavam simplesmente recebendo um direito concedido pelo Estado. Estavam ocupando um espaço que havia sido negado a elas por muito tempo — e que só se tornou possível porque outras mulheres haviam lutado antes.',
    'Os documentos desta investigação registram essa mudança, mas também revelam seus limites.',
    'Os jornais mencionam a presença feminina, elogiam o “patriotismo” das eleitoras e anunciam uma “nova era”. Ao mesmo tempo, informam quantos eleitores compareceram às urnas sem dizer quantas eram mulheres, quase não registram seus nomes e continuam reservando aos homens a maior parte do protagonismo político.',
    'As mulheres estavam lá.',
    'Mas estar presente ainda não significava ser plenamente vista, ouvida ou reconhecida.',
    'Essa talvez seja uma das maiores lições deixadas por 1933: <strong><em>conquistar um direito é fundamental, mas transformá-lo em participação efetiva é uma tarefa muito maior.</em></strong>',
    'A legislação pode mudar rapidamente. As estruturas de poder, os costumes e as ideias sobre quem “pertence” a determinados espaços mudam de forma muito mais lenta.',
    'É por isso que esta história não termina com o direito ao voto.',
    'Democracia também significa participar, questionar, acompanhar decisões, defender direitos, formar opiniões com responsabilidade e ocupar espaços de representação. Significa compreender que a política não pertence apenas a candidatos, partidos ou instituições: ela também é construída pelas pessoas que decidem não permanecer indiferentes.',
    'E, para as mulheres, ocupar esses espaços possui um significado ainda mais profundo.',
    'Por muito tempo, disseram que política não era lugar de mulher. Que decisões importantes deveriam permanecer nas mãos dos homens. Que algumas vozes deveriam ser ouvidas e outras apenas representadas.',
    'A história das eleitoras de 1933 mostra justamente o contrário.',
    'Espaços que foram negados às mulheres não precisam continuar sem elas.',
    'Na política, na ciência, na educação, nas instituições, nas lideranças e em qualquer lugar onde decisões sobre a sociedade sejam tomadas, mulheres têm o direito não apenas de estar presentes, mas de falar, decidir, liderar e transformar.',
    'Se você chegou até aqui, obrigada por percorrer esta história.',
    'Obrigada por conhecer essas mulheres, observar seus documentos, questionar seus silêncios e perceber que, por trás de uma data como 1933, existem décadas de luta, resistência e transformação.',
    'E, especialmente às mulheres que chegaram até aqui: sejam fortes, sejam resistentes e não se acostumem ao silêncio. Suas vozes merecem ser ouvidas, suas escolhas merecem ser respeitadas e os espaços que um dia lhes foram negados também pertencem a vocês.',
    'Espero que este jogo não termine apenas com aquilo que você aprendeu.',
    'Espero que termine também com aquilo que você passou a questionar.',
    'Porque conhecer a história de um direito é também compreender o valor de exercê-lo.',
    'A urna de 1933 encerrou uma votação.',
    'Não encerrou a disputa pela cidadania.',
    'Então, agora que você conhece essa história, fica uma última pergunta:',
    '<strong><em>Que espaço você escolhe ocupar a partir daqui?</em></strong>'
  ];
};

GameLogic.showFinalLetter = function() {
  if(!this.user || !this.progress) return;
  document.getElementById('finalLetterOverlay')?.remove();
  document.getElementById('finalThanksScreen')?.remove();
  if(this.isDialogueActive && typeof this.dismissDialogueLayer === 'function') this.dismissDialogueLayer();

  const overlay = document.createElement('section');
  overlay.id = 'finalLetterOverlay';
  overlay.className = 'final-letter-overlay final-ending-stage';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'finalLetterTitle');
  overlay.innerHTML = `
    ${this.getEndingBackdropMarkup()}
    <div class="ending-envelope-back" aria-hidden="true"></div>
    <article class="ending-letter-paper">
      <span class="ending-paper-reference" aria-hidden="true">REF. MUZ-1933 • CARTA 01</span>
      <div class="ending-paper-ornaments" aria-hidden="true">
        <span class="ending-ornament ending-ornament-tl">❦</span>
        <span class="ending-ornament ending-ornament-tr">❦</span>
        <span class="ending-ornament ending-ornament-bl">❦</span>
        <span class="ending-ornament ending-ornament-br">❦</span>
      </div>
      <header class="ending-letter-heading">
        <span>Mensagem final</span>
        <h2 id="finalLetterTitle">Para quem chegou até<br>aqui</h2>
      </header>
      <div class="ending-letter-body" tabindex="0" aria-label="Carta de encerramento. Role para continuar a leitura.">
        ${this.getFinalLetterParagraphs().map(paragraph => `<p>${paragraph}</p>`).join('')}
        <p class="ending-letter-signature"><span>Com carinho,</span><strong>Aline</strong></p>
      </div>
    </article>
    <div class="ending-envelope-front" aria-hidden="true">
      <span class="ending-envelope-caption">Arquivo Central • Muzambinho, 1933</span>
      <span class="ending-envelope-flourish">❦</span>
    </div>
    <button class="ending-letter-seal final-letter-continue" type="button" aria-label="Fechar esta folha e continuar para a mensagem final">
      <span>Continuar</span>
      <small>a leitura</small>
    </button>
  `;

  document.body.classList.add('final-ending-open');
  document.body.appendChild(overlay);
  const close = () => this.closeFinalLetter();
  overlay.querySelector('.final-letter-continue')?.addEventListener('click', close);
  requestAnimationFrame(() => {
    overlay.classList.add('active');
    overlay.querySelector('.ending-letter-body')?.focus({ preventScroll: true });
  });
};

GameLogic.closeFinalLetter = function() {
  const overlay = document.getElementById('finalLetterOverlay');
  if(overlay?.dataset.closing === 'true') return;

  if(overlay) {
    overlay.dataset.closing = 'true';
    overlay.querySelector('.ending-letter-seal')?.setAttribute('disabled', '');
    overlay.classList.add('closing-letter');
  }

  this.persistFinalFlag('finalLetterSeenVersion');

  setTimeout(() => {
    overlay?.classList.add('leaving');
    this.showFinalThanksPage({ fromLetter: true });
  }, 520);

  setTimeout(() => {
    overlay?.remove();
  }, 780);
};

GameLogic.showFinalThanksPage = function({ fromLetter = false } = {}) {
  if(!this.user || !this.progress) return;
  document.getElementById('finalThanksScreen')?.remove();
  const isAdmin = Boolean(this.user.isAdmin);
  const screen = document.createElement('section');
  screen.id = 'finalThanksScreen';
  screen.className = `final-thanks-screen final-ending-stage final-ending-thanks ${fromLetter ? 'from-letter' : ''} ${isAdmin ? 'admin-mode' : 'player-mode'}`;
  screen.setAttribute('aria-labelledby', 'finalThanksTitle');
  screen.innerHTML = `
    ${this.getEndingBackdropMarkup()}
    <div class="ending-envelope-back" aria-hidden="true"></div>
    <article class="ending-thanks-paper ending-farewell-paper">
      <span class="ending-paper-reference" aria-hidden="true">REF. MUZ-1933 • CARTA 02</span>
      <div class="ending-paper-ornaments" aria-hidden="true">
        <span class="ending-ornament ending-ornament-tl">❦</span>
        <span class="ending-ornament ending-ornament-tr">❦</span>
        <span class="ending-ornament ending-ornament-bl">❦</span>
        <span class="ending-ornament ending-ornament-br">❦</span>
      </div>
      <span class="ending-thanks-kicker">Uma última página</span>
      <h2 id="finalThanksTitle">Obrigada por chegar até aqui</h2>
      <div class="ending-farewell-copy">
        <p class="ending-farewell-lead">e caminhar conosco por essa história.</p>
        <p>Esperamos que esta experiência tenha ajudado você a conhecer um pouco mais sobre o voto feminino em Muzambinho e sobre as mulheres que fizeram parte dessa conquista.</p>
        <p>A história continua além do jogo. Leia nosso artigo completo em:</p>
        <a class="ending-article-link" href="https://example.com/artigo-luzes-de-maio" target="_blank" rel="noopener noreferrer">
          <span class="ending-article-staple" aria-hidden="true"></span>
          <span class="ending-article-copy">
            <small>Fonte complementar</small>
            <strong>Leia o artigo completo</strong>
          </span>
          <span class="ending-article-arrow" aria-hidden="true">↗</span>
        </a>
        <p class="ending-review-invite">E, antes de ir, conte para nós como foi viver essa experiência. <strong>Sua avaliação também faz parte dessa história.</strong></p>
        <button class="ending-review-link final-review-link" type="button">
          <span>Avaliar esta experiência</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
    <div class="ending-envelope-front" aria-hidden="true">
      <span class="ending-envelope-caption">Arquivo Central • Muzambinho, 1933</span>
      <span class="ending-envelope-flourish">❦</span>
    </div>
    <button class="ending-letter-seal final-review-btn" type="button" aria-label="Abrir a avaliação do jogo">
      <span>Avaliar</span>
      <small>experiência</small>
    </button>
  `;

  document.body.classList.add('final-ending-open');
  document.body.appendChild(screen);
  this.persistFinalFlag('finalThanksShownVersion');
  const openReview = () => {
    if(screen.dataset.closing === 'true') return;
    screen.dataset.closing = 'true';
    screen.querySelector('.ending-letter-seal')?.setAttribute('disabled', '');
    screen.querySelector('.final-review-link')?.setAttribute('disabled', '');
    screen.classList.add('closing-letter');
    this.persistFinalFlag('finalThanksDismissedVersion');
    setTimeout(() => screen.classList.add('leaving'), 520);
    setTimeout(() => {
      screen.remove();
      document.body.classList.remove('final-ending-open');
      if(typeof this.openModal === 'function') this.openModal('review');
    }, 780);
  };
  screen.querySelector('.final-review-btn')?.addEventListener('click', openReview);
  screen.querySelector('.final-review-link')?.addEventListener('click', openReview);
  requestAnimationFrame(() => screen.classList.add('active'));
};

GameLogic.dismissFinalThanks = function() {
  this.persistFinalFlag('finalThanksDismissedVersion');
  const screen = document.getElementById('finalThanksScreen');
  if(screen) {
    screen.classList.remove('active');
    setTimeout(() => {
      screen.remove();
      document.body.classList.remove('final-ending-open');
    }, 260);
  }
};

GameLogic.showEndingIfNeeded = function() {
  if(!this.user || !this.progress || !this.isGameFinished()) return false;
  if(document.getElementById('finalLetterOverlay') || document.getElementById('finalThanksScreen')) return true;

  const seenLetter = this.progress.finalLetterSeenVersion === this.finalEndingVersion;
  const dismissedThanks = this.progress.finalThanksDismissedVersion === this.finalEndingVersion;

  if(seenLetter && dismissedThanks) return false;
  if(!seenLetter) {
    this.showFinalLetter();
    return true;
  }

  this.showFinalThanksPage();
  return true;
};

const LMFinalOriginalInit = GameLogic.init;
GameLogic.init = function() {
  LMFinalOriginalInit.call(this);
  if(this.user && this.progress) {
    setTimeout(() => this.showEndingIfNeeded(), 760);
  }
};

const LMPhaseFeedbackAdvanceDialogue = GameLogic.advanceDialogue;
GameLogic.advanceDialogue = function() {
  const contextBefore = this.dialogueContext;
  LMPhaseFeedbackAdvanceDialogue.call(this);

  if (!this.isDialogueActive && contextBefore === 'phase_feedback' && this.pendingPhaseAfterDialogue) {
    const pending = this.pendingPhaseAfterDialogue;
    this.pendingPhaseAfterDialogue = null;
    const isFinalEnding = pending.nextChapterIndex === null && this.isGameFinished();
    setTimeout(() => {
      if(isFinalEnding) this.showFinalLetter();
      else this.showChapterTimeline(pending.chapterIndex, pending.nextChapterIndex);
    }, 250);
  }
};

GameLogic.startBackTransition = function(href = 'index.html') {
    if(document.querySelector('.back-transition-overlay')) return;
    const existing = document.querySelector('.back-transition-overlay');
    if(existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'back-transition-overlay';
    overlay.innerHTML = `
      <div class="back-time-tunnel" aria-hidden="true"></div>
      <div class="back-time-vignette" aria-hidden="true"></div>
      <div class="back-year-counter" id="backYearCounter">1933</div>
      <div class="back-return-card" aria-hidden="true">
        <span>Arquivo Central</span>
        <strong>Retorno ao presente</strong>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const counter = overlay.querySelector('#backYearCounter');
    const startYear = 1933;
    const endYear = 2026;
    const duration = 1040;
    let startTime = null;

    const tick = (timestamp) => {
      if(!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const year = Math.floor(startYear + ((endYear - startYear) * eased));

      if(counter) {
        counter.innerText = String(year);
        if(progress > 0.22 && progress < 0.86) {
          counter.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px) scale(1.16)`;
        } else {
          counter.style.transform = progress > 0.86 ? 'scale(1.34)' : 'scale(1)';
        }
      }

      if(progress < 1) window.requestAnimationFrame(tick);
      else if(counter) counter.innerText = String(endYear);
    };

    window.requestAnimationFrame(tick);
    setTimeout(() => overlay.classList.add('blackout'), 1100);
    setTimeout(() => { window.location.href = href; }, 1480);
};

GameLogic.bindBackTransition = function() {
  if(this.backTransitionBound) return;
  this.backTransitionBound = true;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-back-transition]');
    if(!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    this.startBackTransition(link.getAttribute('href') || 'index.html');
  });
};

document.addEventListener('DOMContentLoaded', () => {
  GameLogic.bindBackTransition();
  GameLogic.loadPhaseContent().finally(() => GameLogic.init());
});
