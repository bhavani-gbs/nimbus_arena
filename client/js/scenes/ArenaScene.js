export class ArenaScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArenaScene' });
    this.players = new Map();
    this.projectiles = new Map();
    this.localPlayer = null;
    this.inputSequence = 0;
    this.pendingInputs = [];
  }

  init(data) {
    this.networkManager = data.networkManager;
    this.setupNetworkHandlers();
  }

  preload() {
    // Create simple colored squares for players and projectiles
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    this.load.image('projectile', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  }

  create() {
    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x2d3748);
    // Create grid pattern
    for (let x = 0; x < 800; x += 50) {
      this.add.line(400, 300, x, 0, x, 600, 0x4a5568, 0.3);
    }
    for (let y = 0; y < 600; y += 50) {
      this.add.line(400, 300, 0, y, 800, y, 0x4a5568, 0.3);
    }
    // Setup input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    // Mouse input for shooting
    this.input.on('pointerdown', (pointer) => {
      if (this.localPlayer) {
        const angle = Phaser.Math.Angle.Between(
          this.localPlayer.x,
          this.localPlayer.y,
          pointer.x,
          pointer.y
        );
        this.networkManager.send({
          type: 'SHOOT',
          angle: angle
        });
      }
    });
    // Join game
    this.networkManager.send({ type: 'JOIN_GAME' });
  }

  setupNetworkHandlers() {
    this.networkManager.on('GAME_JOINED', (data) => {
      this.localPlayerId = data.playerId;
    });

    this.networkManager.on('GAME_STATE', (data) => {
      this.handleServerUpdate(data.state);
    });

    this.networkManager.on('WAITING_FOR_PLAYERS', (data) => {
      console.log(`Waiting for players... ${data.count}/2 minimum`);
    });
  }

  handleServerUpdate(state) {
    // Update or create players
    state.players.forEach(playerData => {
      if (!this.players.has(playerData.id)) {
        this.createPlayer(playerData);
      } else {
        this.updatePlayer(playerData);
      }
    });
    // Remove disconnected players
    this.players.forEach((player, id) => {
      if (!state.players.find(p => p.id === id)) {
        player.sprite.destroy();
        player.nameText.destroy();
        this.players.delete(id);
      }
    });
    // Update projectiles
    state.projectiles.forEach(projData => {
      if (!this.projectiles.has(projData.id)) {
        const proj = this.add.circle(projData.x, projData.y, 5, 0xff0000);
        this.projectiles.set(projData.id, proj);
      } else {
        const proj = this.projectiles.get(projData.id);
        proj.x = projData.x;
        proj.y = projData.y;
      }
    });
    // Remove old projectiles
    this.projectiles.forEach((proj, id) => {
      if (!state.projectiles.find(p => p.id === id)) {
        proj.destroy();
        this.projectiles.delete(id);
      }
    });
    // Update score display
    if (this.localPlayer) {
      const playerData = state.players.find(p => p.id === this.localPlayerId);
      if (playerData) {
        document.getElementById('score').textContent = playerData.score;
      }
    }
  }

  createPlayer(playerData) {
    const sprite = this.add.circle(playerData.x, playerData.y, 15,
      playerData.id === this.localPlayerId ? 0x00ff00 : 0x3182ce);

    const nameText = this.add.text(playerData.x, playerData.y - 25,
      playerData.username, {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

    const player = {
      sprite,
      nameText,
      x: playerData.x,
      y: playerData.y,
      serverX: playerData.x,
      serverY: playerData.y
    };

    this.players.set(playerData.id, player);

    if (playerData.id === this.localPlayerId) {
      this.localPlayer = player;
    }
  }

  updatePlayer(playerData) {
    const player = this.players.get(playerData.id);
    if (!player) return;

    if (playerData.id === this.localPlayerId) {
      // Client-side reconciliation
      player.serverX = playerData.x;
      player.serverY = playerData.y;

      // Remove acknowledged inputs
      this.pendingInputs = this.pendingInputs.filter(
        input => input.sequence > playerData.sequenceNumber
      );

      // Replay unacknowledged inputs
      let x = player.serverX;
      let y = player.serverY;

      this.pendingInputs.forEach(input => {
        const result = this.applyInput(x, y, input.input);
        x = result.x;
        y = result.y;
      });

      player.x = x;
      player.y = y;
    } else {
      // Interpolate other players
      player.serverX = playerData.x;
      player.serverY = playerData.y;
    }
  }

  applyInput(x, y, input) {
    const speed = 200 * (1/60); // Assume 60fps
    let newX = x;
    let newY = y;

    if (input.left) newX -= speed;
    if (input.right) newX += speed;
    if (input.up) newY -= speed;
    if (input.down) newY += speed;

    // Normalize diagonal movement
    if ((input.left || input.right) && (input.up || input.down)) {
      const factor = 0.707;
      const dx = newX - x;
      const dy = newY - y;
      newX = x + dx * factor;
      newY = y + dy * factor;
    }

    // Keep in bounds
    newX = Math.max(15, Math.min(785, newX));
    newY = Math.max(15, Math.min(585, newY));

    return { x: newX, y: newY };
  }

  update() {
    // Handle input
    const input = {
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown
    };

    // Only send input if it changed
    if (this.hasInputChanged(input)) {
      this.inputSequence++;

      // Send to server
      this.networkManager.send({
        type: 'PLAYER_INPUT',
        input: input,
        sequenceNumber: this.inputSequence
      });

      // Store for reconciliation
      this.pendingInputs.push({
        input: input,
        sequence: this.inputSequence
      });
    }

    // Apply local prediction
    if (this.localPlayer) {
      const result = this.applyInput(this.localPlayer.x, this.localPlayer.y, input);
      this.localPlayer.x = result.x;
      this.localPlayer.y = result.y;
      this.localPlayer.sprite.x = this.localPlayer.x;
      this.localPlayer.sprite.y = this.localPlayer.y;
      this.localPlayer.nameText.x = this.localPlayer.x;
      this.localPlayer.nameText.y = this.localPlayer.y - 25;
    }

    // Interpolate other players
    this.players.forEach((player, id) => {
      if (id !== this.localPlayerId) {
        player.x += (player.serverX - player.x) * 0.1;
        player.y += (player.serverY - player.y) * 0.1;
        player.sprite.x = player.x;
        player.sprite.y = player.y;
        player.nameText.x = player.x;
        player.nameText.y = player.y - 25;
      }
    });
  }

  hasInputChanged(input) {
    if (!this.lastInput) {
      this.lastInput = { ...input };
      return true;
    }
    const changed = Object.keys(input).some(key => input[key] !== this.lastInput[key]);
    if (changed) {
      this.lastInput = { ...input };
    }
    return changed;
  }
}