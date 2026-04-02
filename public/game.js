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
    this.tutorialStage = 0;

    this.bindEvents();

    const localUser = JSON.parse(localStorage.getItem('lm_user'));
    const userName = localUser ? localUser.name : "Investigador(a)";

    setTimeout(() => {
      this.startDialogue([
        `Olá, ${userName}. Sou a voz daquelas que vieram antes de você e lutaram pelo nosso lugar.`,
        "Em maio de 1933, as mulheres foram às urnas, mas os registros acabaram esquecidos nesta gaveta de aço.",
        "Antes de puxar a primeira ficha, olhe para a aba anexada no canto direito da tela.",
        "Clique no 'Inventário'. É lá que você guardará os documentos cruciais que encontrar."
      ], "tutorial_inv");
    }, 1200);
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
  },

  startDialogue(linesArray, context = "normal") {
    this.currentLines = linesArray;
    this.currentLineIndex = 0;
    this.isDialogueActive = true;
    this.dialogueContext = context;

    this.dialogueText.innerText = this.currentLines[this.currentLineIndex];
    this.npcOverlay.classList.add('active');
    this.board.classList.add('blurred');
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
      } else {
        this.npcOverlay.classList.remove('active');
        this.board.classList.remove('blurred');
      }
    }
  },

  openInventory() {
    this.invOverlay.classList.add('active');
    if(this.invBtn) this.invBtn.classList.remove('highlight-pulse');

    if(this.tutorialStage === 1) {
      this.tutorialStage = 2;
      setTimeout(() => {
        this.startDialogue([
          "Perfeito. O Dossiê está vazio agora, mas logo será preenchido.",
          "Pode fechar e clicar na Ficha 01: 'Nacional'. O Brasil precisou mudar para que nossa cidade pudesse votar."
        ], "normal");
      }, 500);
    }
  },

  closeInventory() {
    this.invOverlay.classList.remove('active');
  },

  clickPhase(phaseNum, phaseName) {
    if(this.isDialogueActive) return;
    
    if(this.tutorialStage < 2) {
      this.startDialogue(["Ainda não. Por favor, clique na aba Inventário no canto direito da tela antes de investigar."], "tutorial_inv");
      return;
    }

    alert(`Sucesso! Carregando arquivos da fase: ${phaseName}...`);
  },

  checkLocked(phaseName) {
    event.stopPropagation();
    if(this.isDialogueActive) return;

    this.startDialogue([
      `As fichas sobre "${phaseName}" estão seladas com grampos da censura.`,
      `Não pule etapas. Leia a Ficha 01 primeiro.`
    ], "normal");
  }
};

document.addEventListener('DOMContentLoaded', () => GameLogic.init());