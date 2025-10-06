import { Player } from './Player.js';
import { GameLogic } from './GameLogic.js';

export class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.projectiles = [];
        this.gameLogic = new GameLogic();
        this.width = 800;
        this.height = 600;
        this.started = false;
    }

    addPlayer(id, username) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const player = new Player(id, username, x, y);
        this.players.set(id, player);
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
        player.setInput(input);
        player.lastSequenceNumber = sequenceNumber;
    }

    handleShoot(playerId, angle) {
        const player = this.players.get(playerId);
        if (!player || !player.canShoot()) return;
        const projectile = {
            id: Math.random().toString(36),
            ownerId: playerId,
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * 500,
            vy: Math.sin(angle) * 500,
            lifetime: 1000
        };
        this.projectiles.push(projectile);
        player.lastShot = Date.now();
    }

    update(deltaTime) {
        if (!this.started) return;
        // Update players
        this.players.forEach(player => {
            player.update(deltaTime / 1000, this.width, this.height);
        });
        // Update projectiles
        this.projectiles = this.projectiles.filter(proj => {
            proj.x += proj.vx * deltaTime / 1000;
            proj.y += proj.vy * deltaTime / 1000;
            proj.lifetime -= deltaTime;
            // Check collisions
            this.players.forEach(player => {
                if (player.id !== proj.ownerId) {
                    const dist = Math.sqrt(
                        Math.pow(player.x - proj.x, 2) +
                        Math.pow(player.y - proj.y, 2)
                    );
                    if (dist < 20) {
                        player.respawn(this.width, this.height);
                        const shooter = this.players.get(proj.ownerId);
                        if (shooter) {
                            shooter.score += 10;
                        }
                        proj.lifetime = 0;
                    }
                }
            });
            return proj.lifetime > 0 &&
                proj.x >= 0 && proj.x <= this.width &&
                proj.y >= 0 && proj.y <= this.height;
        });
    }

    getState() {
        return {
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                username: p.username,
                x: p.x,
                y: p.y,
                score: p.score,
                sequenceNumber: p.lastSequenceNumber
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