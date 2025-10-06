import { NetworkManager } from './network/NetworkManager.js';
import { LoginScene } from './scenes/LoginScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';

class NimbusArena {
    constructor() {
        this.networkManager = new NetworkManager();
        this.setupUI();
        this.initPhaser();
    }

    setupUI() {
        // Login handlers
        document.getElementById('login-btn').addEventListener('click', () => {
            this.handleLogin();
        });

        document.getElementById('register-btn').addEventListener('click', () => {
            this.handleRegister();
        });

        document.getElementById('leaderboard-btn').addEventListener('click', () => {
            this.showLeaderboard();
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            this.hideLeaderboard();
        });

        // Enter key support
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showMessage('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                this.startGame(data.token);
            } else {
                this.showMessage(data.error || 'Login failed');
            }
        } catch (error) {
            this.showMessage('Connection error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showMessage('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                this.startGame(data.token);
            } else {
                this.showMessage(data.error || 'Registration failed');
            }
        } catch (error) {
            this.showMessage('Connection error');
        }
    }

    showMessage(message) {
        document.getElementById('login-message').textContent = message;
    }

    startGame(token) {
        document.getElementById('login-ui').classList.add('hidden');
        document.getElementById('game-ui').classList.remove('hidden');

        this.networkManager.connect(token);
        this.game.scene.start('ArenaScene', { networkManager: this.networkManager });
    }

    async showLeaderboard() {
        try {
            const response = await fetch('http://localhost:3000/api/leaderboard');
            const data = await response.json();

            const listEl = document.getElementById('leaderboard-list');
            listEl.innerHTML = data.map(entry => `
                <div class="leaderboard-entry">
                    <span class="rank">#${entry.rank}</span>
                    <span>${entry.username}</span>
                    <span>${entry.score} pts</span>
                </div>
            `).join('');

            document.getElementById('leaderboard-ui').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load leaderboard');
        }
    }

    hideLeaderboard() {
        document.getElementById('leaderboard-ui').classList.add('hidden');
    }

    initPhaser() {
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            parent: 'phaser-game',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [LoginScene, ArenaScene, LeaderboardScene]
        };

        this.game = new Phaser.Game(config);
    }
}