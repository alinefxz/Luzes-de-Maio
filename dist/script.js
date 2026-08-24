// =========================================================
// LÓGICA PRINCIPAL DO JOGO (MESA, GAVETA E INVENTÁRIO)
// =========================================================
const GameLogic = {
  init() {
    this.board = document.getElementById('gameBoard');
    this.npcOverlay = document.getElementById('npcOverlay');
    this.dialogueText = document.getElementById('npcDialogueText');
    this.invOverlay = document.getElementById('inventoryOverlay');
    this.dialogueBox = document.querySelector('.npc-dialogue-box');
    this.invBtn = document.getElementById('inventoryBtn');
    this.closeInvBtn = document.getElementById('closeInvBtn');
    
    this.isDialogueActive = false;
    this.currentLines = [];
    this.currentLineIndex = 0;
    
    // RECUPERA O JOGADOR E O PROGRESSO
    this.user = JSON.parse(localStorage.getItem('lm_user')) || null;
    let savedProgress = JSON.parse(localStorage.getItem('lm_progress'));
    
    if (this.user && this.user.progress) {
        this.progress = this.user.progress;
    } else if (savedProgress) {
        this.progress = savedProgress;
    } else {
        this.progress = { tutorialCompleted: false, unlockedPhases: [1], collectedEvidence: [] };
    }
    
    // Garante que o array existe para jogadores antigos
    if(!this.progress.collectedEvidence) this.progress.collectedEvidence = [];
    
    this.tutorialStage = this.progress.tutorialCompleted ? 2 : 0;

    this.bindEvents();
    this.restoreGameState();
    
    // INICIALIZA OS NOVOS ELEMENTOS INTERATIVOS
    this.setupStars();
    this.setupLamp();
    this.setupReviewForm();

    // RENDERIZA O INVENTÁRIO AO CARREGAR
    this.renderInventory();

    if (this.tutorialStage === 0) {
      const userName = this.user ? (this.user.fullName || this.user.name) : "Investigador(a)";
      setTimeout(() => {
        this.startDialogue([
          `Olá, ${userName}. Sou a voz daquelas que vieram antes de você e lutaram pelo nosso lugar.`,
          "Em maio de 1933, as mulheres foram às urnas, mas os registros acabaram esquecidos nesta gaveta de aço.",
          "Antes de puxar a primeira ficha, olhe para a aba anexada no canto direito da tela.",
          "Clique no 'Inventário'. É lá que você guardará os documentos cruciais que encontrar."
        ], "tutorial_inv");
      }, 1200);
    }
  },

  setupLamp() {
    const lamp = document.getElementById('tableLamp');
    if(lamp) {
      lamp.onclick = () => {
        document.body.classList.toggle('lamp-on');
      };
    }
  },

  setupStars() {
    const stars = document.querySelectorAll('.star');
    const ratingInput = document.getElementById('ratingValue');
    
    stars.forEach(star => {
      star.onclick = () => {
        const val = star.getAttribute('data-value');
        ratingInput.value = val;
        
        stars.forEach(s => s.classList.remove('active'));
        star.classList.add('active');
      };
    });
  },

  setupReviewForm() {
    const reviewForm = document.getElementById('reviewForm');
    if(reviewForm) {
      reviewForm.onsubmit = (e) => {
        e.preventDefault(); 
        
        const rating = document.getElementById('ratingValue').value;
        const mechanics = document.getElementById('r_mechanics').value;
        const immersion = document.getElementById('r_immersion').value;
        const improvements = document.getElementById('r_improvements').value;

        // Validação: Garante que o jogador deu pelo menos 1 estrela
        if(rating === "0") {
          alert("Por favor, atribua uma nota de 1 a 5 estrelas no topo do documento.");
          return;
        }

        // Salva a avaliação no progresso do jogador
        this.progress.finalReview = { rating, mechanics, immersion, improvements };
        this.saveGameProgress();

        // Feedback Visual Épico de Conclusão
        const submitBtn = reviewForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = "DOCUMENTO SELADO E ENVIADO!";
        submitBtn.style.backgroundColor = "#3b5336"; 
        submitBtn.style.color = "#fff";
        submitBtn.style.borderColor = "#2a3d26";
        submitBtn.disabled = true;

        submitBtn.style.transform = "scale(1.05)";
        setTimeout(() => submitBtn.style.transform = "scale(1)", 200);

        // Mensagem final de despedida
        setTimeout(() => {
          this.startDialogue([
            "Recebemos o seu relatório.",
            "Obrigada por nos ajudar a tirar essa história do escuro. A memória vive através de você.",
            "A investigação está oficialmente encerrada. Pode abandonar a mesa quando quiser."
          ], "normal");
        }, 1500);
      };
    }
  },

  async saveGameProgress() {
    if(this.user) {
        this.user.progress = this.progress;
    }
    
    localStorage.setItem('lm_progress', JSON.stringify(this.progress));
    
    if(this.user) {
        localStorage.setItem('lm_user', JSON.stringify(this.user));
        try {
          await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.user)
          });
        } catch (e) {
          console.log("Progresso salvo offline.");
        }
    }
  },

  addEvidenceToInventory(title, text) {
    const alreadyExists = this.progress.collectedEvidence.some(e => e.title === title);
    if (!alreadyExists) {
      this.progress.collectedEvidence.push({ title, text });
      this.saveGameProgress();
    }
    this.renderInventory();
  },

  renderInventory() {
    const invBody = document.getElementById('inventoryBody');
    if (!invBody) return;
    
    if (this.progress.collectedEvidence.length === 0) {
      invBody.innerHTML = `
        <div class="empty-inv-state" id="emptyInvText">
          <div class="empty-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <p class="empty-title">A pasta está vazia</p>
          <p class="empty-subtitle">Nenhuma prova anexada. Vasculhe as fichas da gaveta de aço para coletar pistas.</p>
        </div>
      `;
      invBody.style.display = 'flex';
      invBody.style.justifyContent = 'center';
      invBody.style.alignItems = 'center';

    } else {
      invBody.style.display = 'block';
      invBody.style.padding = '20px 40px';
      
      let itemsHTML = this.progress.collectedEvidence.map((ev, index) => {
        const rot = index % 2 === 0 ? '-1deg' : '1.5deg';
        return `
          <div class="inventory-item" style="transform: rotate(${rot}); background: #fdfbf7; border: 1px solid #ccc; padding: 25px 20px; margin-bottom: 25px; box-shadow: 2px 5px 15px rgba(0,0,0,0.1); position: relative; border-radius: 2px;">
            <div class="inv-item-clip" style="position: absolute; top: -15px; right: 20px; width: 12px; height: 35px; border: 3px solid #888; border-radius: 6px; transform: rotate(10deg); box-shadow: 1px 2px 3px rgba(0,0,0,0.2);"></div>
            <h4 class="inv-item-title" style="font-family: var(--font-serif); color: var(--wine); font-size: 1.4rem; border-bottom: 1px solid rgba(147,88,94,0.3); padding-bottom: 5px; margin-bottom: 10px;">${ev.title}</h4>
            <div class="inv-item-text" style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--charcoal); line-height: 1.6;">${ev.text}</div>
          </div>
        `;
      }).join('');
      
      invBody.innerHTML = itemsHTML;
    }
  },

  restoreGameState() {
    if(this.progress.unlockedPhases.includes(2)) {
      const phase2 = document.getElementById('phase2');
      if(phase2) {
        phase2.classList.remove('folder-locked');
        phase2.classList.add('folder-active');
        phase2.querySelector('h4').innerText = "O Código de 1932";
        phase2.querySelector('p').innerText = "A conquista da lei. Analise as atas.";
        phase2.querySelector('.confidential-stamp').innerText = "LIVRE";
        phase2.querySelector('.confidential-stamp').classList.remove('locked');
        phase2.onclick = () => this.clickPhase(2, 'O Código de 1932');
      }
    }
    if(this.progress.unlockedPhases.includes(3)) {
      const phase3 = document.getElementById('phase3');
      if(phase3) {
        phase3.classList.remove('folder-locked');
        phase3.classList.add('folder-active');
        phase3.querySelector('h4').innerText = "Caso Muzambinho";
        phase3.querySelector('p').innerText = "Os registros locais e as primeiras eleitoras.";
        phase3.querySelector('.confidential-stamp').innerText = "LIVRE";
        phase3.querySelector('.confidential-stamp').classList.remove('locked');
        phase3.onclick = () => this.clickPhase(3, 'Caso Muzambinho');
      }
    }
    if(this.progress.unlockedPhases.includes(4)) {
       const lockedView = document.getElementById('reviewLocked');
       const unlockedView = document.getElementById('reviewUnlocked');
       if(lockedView && unlockedView) {
           lockedView.style.display = 'none';
           unlockedView.style.display = 'block';
       }
    }
  },

  unlockNextPhase(currentPhaseNum) {
    const nextPhase = currentPhaseNum + 1;
    if (!this.progress.unlockedPhases.includes(nextPhase)) {
      this.progress.unlockedPhases.push(nextPhase);
      this.saveGameProgress();
      this.restoreGameState();
      
      if (currentPhaseNum === 3) {
        setTimeout(() => {
          this.startDialogue([
            "Incrível trabalho, Investigador(a).",
            "Você recuperou as peças fundamentais da nossa história.",
            "O Relatório Final no Índice superior agora está liberado para o seu parecer."
          ], "normal");
          
          const lockedView = document.getElementById('reviewLocked');
          const unlockedView = document.getElementById('reviewUnlocked');
          if(lockedView && unlockedView) {
              lockedView.style.display = 'none';
              unlockedView.style.display = 'block';
          }
        }, 1000);
      } else {
        setTimeout(() => {
          this.startDialogue([
            `Excelente dedução! O documento foi anexado ao dossiê.`,
            `O selo de censura da próxima etapa acabou de ser rompido na gaveta de aço.`
          ], "normal");
        }, 1000);
      }
    }
  },

  bindEvents() {
    if(this.dialogueBox) {
      this.dialogueBox.addEventListener('click', () => {
        if(this.isDialogueActive) this.advanceDialogue();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (this.isDialogueActive && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); 
        this.advanceDialogue();
      }
    });
    if(this.invBtn) this.invBtn.addEventListener('click', () => this.openInventory());
    if(this.closeInvBtn) this.closeInvBtn.addEventListener('click', () => this.closeInventory());

    // Gerenciamento de menu superior
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const fullMenu = document.getElementById('fullMenu');
    
    if(menuBtn && fullMenu) menuBtn.addEventListener('click', () => fullMenu.classList.add('active'));
    if(closeMenuBtn && fullMenu) closeMenuBtn.addEventListener('click', () => fullMenu.classList.remove('active'));

    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeAllModals();
      });
    });
  },

  openModal(id) {
    const fullMenu = document.getElementById('fullMenu');
    if(fullMenu) fullMenu.classList.remove('active'); 
    this.closeAllModals();

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

  startDialogue(linesArray, context = "normal") {
    this.currentLines = linesArray;
    this.currentLineIndex = 0;
    this.isDialogueActive = true;
    this.dialogueContext = context;
    this.dialogueText.innerText = this.currentLines[this.currentLineIndex];
    this.npcOverlay.classList.add('active');
    if(this.board) this.board.classList.add('blurred');
  },

  advanceDialogue() {
    this.currentLineIndex++;
    if (this.currentLineIndex < this.currentLines.length) {
      this.dialogueText.innerText = this.currentLines[this.currentLineIndex];
    } else {
      this.isDialogueActive = false;
      if(this.dialogueContext === "tutorial_inv") {
        this.dialogueText.innerText = "Estou aguardando. Abra seu Inventário na aba lateral 🗂️.";
        if(this.invBtn) this.invBtn.classList.add('highlight-pulse');
        this.tutorialStage = 1;
        this.progress.tutorialCompleted = true;
        this.saveGameProgress();
      } else {
        this.npcOverlay.classList.remove('active');
        if(this.board) this.board.classList.remove('blurred');
      }
    }
  },

  openInventory() {
    if(this.invOverlay) this.invOverlay.classList.add('active');
    if(this.invBtn) this.invBtn.classList.remove('highlight-pulse');
    if(this.tutorialStage === 1) {
      this.tutorialStage = 2; 
      setTimeout(() => {
        this.startDialogue([
          "Perfeito. O Dossiê está vazio agora.",
          "Clique na Ficha 01: 'Nacional'. Responda à pergunta do documento para prosseguir."
        ], "normal");
      }, 500);
    }
  },

  closeInventory() {
    if(this.invOverlay) this.invOverlay.classList.remove('active');
  },

  clickPhase(phaseNum, phaseName) {
    if(this.isDialogueActive) return;
    if(this.tutorialStage < 2) {
      this.startDialogue(["Ainda não. Por favor, clique na aba Inventário no canto direito da tela antes de investigar."], "tutorial_inv");
      return;
    }

    if (phaseNum === 1) {
      EvidenceSystem.spawnEvidence(
        "Ata de 1927", 
        "Rio Grande do Norte: O primeiro estado a permitir o voto feminino. Celina Guimarães Viana entra para a história ao invocar a Lei nº 660, que não distinguia sexo para o alistamento eleitoral.<br><br><i>'Eu não fiz nada de extraordinário...'</i>",
        {
          phaseNum: 1,
          question: "Baseado no documento, qual foi o primeiro estado brasileiro a registrar uma eleitora?",
          options: ["Minas Gerais (Muzambinho)", "São Paulo", "Rio Grande do Norte", "Rio de Janeiro"],
          correctIndex: 2
        }
      );
    } 
    else if (phaseNum === 2) {
      EvidenceSystem.spawnEvidence(
        "Decreto 21.076", 
        "24 de fevereiro de 1932. O Código Eleitoral Brasileiro é promulgado. Art. 2º: É eleitor o cidadão maior de 21 anos, sem distinção de sexo, alistado na forma deste código.",
        {
          phaseNum: 2,
          question: "Segundo o novo Código de 1932, qual era a idade mínima para votar?",
          options: ["18 anos", "21 anos", "25 anos", "16 anos"],
          correctIndex: 1
        }
      );
    }
    else if (phaseNum === 3) {
      EvidenceSystem.spawnEvidence(
        "O Caso Muzambinho", 
        "Em maio de 1933, as luzes de maio brilharam em Muzambinho. As urnas receberam os primeiros votos femininos da cidade, um impacto silencioso, porém permanente nas atas locais.",
        {
          phaseNum: 3,
          question: "Em que ano ocorreu a primeira votação com participação feminina em Muzambinho?",
          options: ["1927", "1932", "1933", "1934"],
          correctIndex: 2
        }
      );
    }
  },

  checkLocked(phaseName) {
    if(event) event.stopPropagation();
    if(this.isDialogueActive) return;
    this.startDialogue([
      `As fichas sobre "${phaseName}" estão seladas com grampos da censura.`,
      `Você precisa ler e responder corretamente o documento da etapa anterior para romper o lacre.`
    ], "normal");
  }
};

// Objeto Global para expor a abertura de modais no HTML
const Game = {
  openModal: (id) => GameLogic.openModal(id)
};

// =========================================================
// SISTEMA DE DOSSIÊ DE INVESTIGAÇÃO (ESQUERDA/DIREITA)
// =========================================================
const EvidenceSystem = {
  currentEvidence: null, 
  
  spawnEvidence(title, text, quizData) {
    this.currentEvidence = { title, text }; 
    
    let existing = document.getElementById('investigationModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'investigationModal';
    overlay.className = 'investigation-overlay';
    
    let quizHTML = '';
    if (quizData) {
      const optionsHTML = quizData.options.map((opt, index) => 
        `<button class="quiz-checkbox-btn" onclick="EvidenceSystem.selectAnswer(this, ${index === quizData.correctIndex}, ${quizData.phaseNum})">
          <span class="check-box">X</span>
          <span class="option-text">${opt}</span>
        </button>`
      ).join('');

      quizHTML = `
        <div class="form-header">
          <div class="form-tag">MINISTÉRIO DA JUSTIÇA</div>
          <h2 class="form-title">Questionário de Análise</h2>
        </div>
        <p class="quiz-question">Ref. ${quizData.phaseNum}: ${quizData.question}</p>
        <div class="quiz-options">${optionsHTML}</div>
        <div class="quiz-feedback"></div>
      `;
    }
    
    overlay.innerHTML = `
      <div class="investigation-dossier" id="dossierContainer">
        <button class="close-investigation" title="Fechar Pasta" onclick="document.getElementById('investigationModal').remove()">✕</button>
        
        <div class="dossier-page page-left">
          <div class="form-tag" style="margin-bottom: 20px; padding-left: 30px;">DOCUMENTO APREENDIDO</div>
          <h2 class="evidence-title">${title}</h2>
          <div class="evidence-text">${text}</div>
        </div>

        <div class="dossier-page page-right">
          ${quizHTML}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
  },

  selectAnswer(btn, isCorrect, phaseNum) {
    const container = btn.closest('.investigation-dossier');
    const feedback = container.querySelector('.quiz-feedback');
    const allBtns = container.querySelectorAll('.quiz-checkbox-btn');

    allBtns.forEach(b => {
      b.classList.remove('selected');
      b.disabled = true; 
    });
    btn.classList.add('selected');

    if (isCorrect) {
      feedback.innerHTML = '<span class="stamp-correct" style="--rot: -5deg;">DEFERIDO</span>';
      
      if (this.currentEvidence) {
        GameLogic.addEvidenceToInventory(this.currentEvidence.title, this.currentEvidence.text);
      }
      
      GameLogic.unlockNextPhase(phaseNum);

      setTimeout(() => {
        const modal = document.getElementById('investigationModal');
        if(modal) modal.remove();
        
        const invBtn = document.getElementById('inventoryBtn');
        if(invBtn) {
          invBtn.classList.remove('highlight-pulse'); 
          void invBtn.offsetWidth; 
          invBtn.classList.add('highlight-pulse');
        }
      }, 2500);

    } else {
      feedback.innerHTML = '<span class="stamp-wrong" style="--rot: 5deg;">INDEFERIDO</span>';
      
      container.classList.remove('shake-error');
      void container.offsetWidth; 
      container.classList.add('shake-error');

      setTimeout(() => {
        allBtns.forEach(b => {
          b.disabled = false;
          b.classList.remove('selected');
        });
        feedback.innerHTML = '';
      }, 1500);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => GameLogic.init());