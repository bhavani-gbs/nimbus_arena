export class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.projectiles = [];
    this.width = 800;
    this.height = 600;
    this.started = false;
  }

  addPlayer(id, username) {
    const x = Math.random() * (this.width - 40) + 20;
    const y = Math.random() * (this.height - 40) + 20;
    this.players.set(id, { 
      username, 
      x, 
      y, 
      score: 0,
      sequenceNumber: 0
    });
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  start() {
    this.started = true;
  }

  handleInput(playerId, input, sequenceNumber) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    const speed = 200 / 60; // 200 pixels per second, 60fps
    let newX = player.x;
    let newY = player.y;
    
    if (input.left) newX -= speed;
    if (input.right) newX += speed;
    if (input.up) newY -= speed;
    if (input.down) newY += speed;
    
    // Normalize diagonal movement
    if ((input.left || input.right) && (input.up || input.down)) {
      const factor = 0.707;
      newX = player.x + (newX - player.x) * factor;
      newY = player.y + (newY - player.y) * factor;
    }
    
    // Keep in bounds
    player.x = Math.max(20, Math.min(this.width - 20, newX));
    player.y = Math.max(20, Math.min(this.height - 20, newY));
    player.sequenceNumber = sequenceNumber;
  }

  handleShoot(playerId, angle) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    this.projectiles.push({
      id: Math.random().toString(36).substring(7),
      ownerId: playerId,
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * 300,
      vy: Math.sin(angle) * 300,
      lifetime: 2000
    });
  }

  update(deltaTime) {
    if (!this.started) return;
    
    // Update projectiles
    this.projectiles = this.projectiles.filter(proj => {
      proj.x += proj.vx * deltaTime / 1000;
      proj.y += proj.vy * deltaTime / 1000;
      proj.lifetime -= deltaTime;
      
      // Check bounds
      if (proj.x < 0 || proj.x > this.width || proj.y < 0 || proj.y > this.height) {
        return false;
      }
      
      // Simple collision detection
      this.players.forEach((player, playerId) => {
        if (playerId !== proj.ownerId) {
          const dist = Math.sqrt(
            Math.pow(player.x - proj.x, 2) + Math.pow(player.y - proj.y, 2)
          );
          if (dist < 25) {
            // Hit player
            const shooter = this.players.get(proj.ownerId);
            if (shooter) {
              shooter.score += 10;
            }
            return false; // Remove projectile
          }
        }
      });
      
      return proj.lifetime > 0;
    });
  }

  getState() {
    return {
      players: Array.from(this.players.values()).map(p => ({
        id: [...this.players.entries()].find(([k]) => this.players.get(k) === p)[0],
        username: p.username,
        x: p.x,
        y: p.y,
        score: p.score,
        sequenceNumber: p.sequenceNumber
      })),
      projectiles: this.projectiles.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y
      }))
    };
  }

  getPlayers() {
    return Array.from(this.players.keys());
  }

  getPlayerCount() {
    return this.players.size;
  }
}