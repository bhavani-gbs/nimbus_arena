import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { GameRoom } from './game/GameRoom.js';
import { initDB, createUser, verifyUser } from './database/db.js';
import { LeaderboardManager } from './redis/leaderboard.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nimbus-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Game state
const gameRooms = new Map();
const playerConnections = new Map();
const waitingPlayers = [];

// Initialize database and Redis
await initDB();
const leaderboard = new LeaderboardManager();

// HTTP Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userId = await createUser(username, password);
        const token = jwt.sign({ userId, username }, JWT_SECRET);
        res.json({ token, username });
    } catch (error) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await verifyUser(username, password);
        const token = jwt.sign({ userId: user.id, username }, JWT_SECRET);
        res.json({ token, username });
    } catch (error) {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    const top = await leaderboard.getTop(10);
    res.json(top);
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    const playerId = uuidv4();

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'AUTH':
                    handleAuth(ws, playerId, data);
                    break;
                case 'JOIN_GAME':
                    handleJoinGame(ws, playerId);
                    break;
                case 'PLAYER_INPUT':
                    handlePlayerInput(playerId, data);
                    break;
                case 'SHOOT':
                    handleShoot(playerId, data);
                    break;
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });

    ws.on('close', () => {
        handleDisconnect(playerId);
    });
});

function handleAuth(ws, playerId, data) {
    try {
        const decoded = jwt.verify(data.token, JWT_SECRET);
        playerConnections.set(playerId, {
            ws,
            userId: decoded.userId,
            username: decoded.username,
            roomId: null
        });

        ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            playerId
        }));
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'AUTH_FAILED'
        }));
        ws.close();
    }
}

function handleJoinGame(ws, playerId) {
    const player = playerConnections.get(playerId);
    if (!player) return;

    waitingPlayers.push(playerId);

    // Try to create a room if we have enough players
    if (waitingPlayers.length >= 2) {
        const roomId = uuidv4();
        const room = new GameRoom(roomId);

        // Take first 8 players (max per room)
        const players = waitingPlayers.splice(0, Math.min(8, waitingPlayers.length));

        players.forEach(pid => {
            const conn = playerConnections.get(pid);
            conn.roomId = roomId;
            room.addPlayer(pid, conn.username);

            conn.ws.send(JSON.stringify({
                type: 'GAME_JOINED',
                roomId,
                playerId: pid
            }));
        });

        gameRooms.set(roomId, room);
        room.start();

        // Start game loop for this room
        startGameLoop(roomId);
    } else {
        ws.send(JSON.stringify({
            type: 'WAITING_FOR_PLAYERS',
            count: waitingPlayers.length
        }));
    }
}

function handlePlayerInput(playerId, data) {
    const player = playerConnections.get(playerId);
    if (!player || !player.roomId) return;

    const room = gameRooms.get(player.roomId);
    if (room) {
        room.handleInput(playerId, data.input, data.sequenceNumber);
    }
}

function handleShoot(playerId, data) {
    const player = playerConnections.get(playerId);
    if (!player || !player.roomId) return;

    const room = gameRooms.get(player.roomId);
    if (room) {
        room.handleShoot(playerId, data.angle);
    }
}

function handleDisconnect(playerId) {
    const player = playerConnections.get(playerId);

    if (player && player.roomId) {
        const room = gameRooms.get(player.roomId);
        if (room) {
            room.removePlayer(playerId);

            // Clean up empty rooms
            if (room.getPlayerCount() === 0) {
                gameRooms.delete(player.roomId);
            }
        }
    }

    // Remove from waiting list
    const index = waitingPlayers.indexOf(playerId);
    if (index > -1) {
        waitingPlayers.splice(index, 1);
    }

    playerConnections.delete(playerId);
}

function startGameLoop(roomId) {
    const room = gameRooms.get(roomId);
    if (!room) return;

    const tickRate = 60; // 60 Hz server tick rate
    const interval = setInterval(() => {
        if (!gameRooms.has(roomId)) {
            clearInterval(interval);
            return;
        }

        room.update(1000 / tickRate);

        // Send state to all players in room
        const state = room.getState();
        room.getPlayers().forEach(playerId => {
            const conn = playerConnections.get(playerId);
            if (conn && conn.ws.readyState === conn.ws.OPEN) {
                conn.ws.send(JSON.stringify({
                    type: 'GAME_STATE',
                    state
                }));
            }
        });
    }, 1000 / tickRate);
}

server.listen(PORT, () => {
    console.log(`Nimbus Arena server running on port ${PORT}`);
});