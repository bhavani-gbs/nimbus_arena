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
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nimbus-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Game state
const gameRooms = new Map();
const playerConnections = new Map();
const waitingPlayers = [];

// Initialize database and Redis
async function startServer() {
  try {
    console.log('Initializing database...');
    await initDB();
    console.log('Database initialized successfully');
    
    const leaderboard = new LeaderboardManager();
    console.log('Leaderboard manager initialized');
    
    // HTTP Routes
    app.post('/api/register', async (req, res) => {
      const { username, password } = req.body;
      try {
        console.log(`Register attempt for: ${username}`);
        const userId = await createUser(username, password);
        const token = jwt.sign({ userId, username }, JWT_SECRET);
        console.log(`User ${username} registered successfully`);
        res.json({ token, username });
      } catch (error) {
        console.error('Registration error:', error.message);
        res.status(400).json({ error: 'Username already exists' });
      }
    });

    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      try {
        console.log(`Login attempt for: ${username}`);
        const user = await verifyUser(username, password);
        const token = jwt.sign({ userId: user.id, username }, JWT_SECRET);
        console.log(`User ${username} logged in successfully`);
        res.json({ token, username });
      } catch (error) {
        console.error('Login error:', error.message);
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    app.get('/api/leaderboard', async (req, res) => {
      try {
        const top = await leaderboard.getTop(10);
        res.json(top);
      } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Leaderboard unavailable' });
      }
    });

    // Create HTTP server
    const server = http.createServer(app);

    // WebSocket server
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      const playerId = uuidv4();
      console.log(`New connection: ${playerId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`Received message type: ${data.type}`);
          
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
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log(`Connection closed: ${playerId}`);
        handleDisconnect(playerId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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
        console.log(`Player ${playerId} authenticated as ${decoded.username}`);
      } catch (error) {
        console.error('Auth failed:', error.message);
        ws.send(JSON.stringify({ type: 'AUTH_FAILED' }));
        ws.close();
      }
    }

    function handleJoinGame(ws, playerId) {
      const player = playerConnections.get(playerId);
      if (!player) return;
      
      waitingPlayers.push(playerId);
      console.log(`Player ${playerId} waiting. Total waiting: ${waitingPlayers.length}`);
      
      if (waitingPlayers.length >= 2) {
        const roomId = uuidv4();
        const room = new GameRoom(roomId);
        const players = waitingPlayers.splice(0, Math.min(8, waitingPlayers.length));
        
        players.forEach(pid => {
          const conn = playerConnections.get(pid);
          if (conn) {
            conn.roomId = roomId;
            room.addPlayer(pid, conn.username);
            conn.ws.send(JSON.stringify({
              type: 'GAME_JOINED',
              roomId,
              playerId: pid
            }));
            console.log(`Player ${pid} joined room ${roomId}`);
          }
        });
        
        gameRooms.set(roomId, room);
        room.start();
        startGameLoop(roomId);
        console.log(`Started game room ${roomId} with ${players.length} players`);
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
          if (room.getPlayerCount() === 0) {
            gameRooms.delete(player.roomId);
            console.log(`Room ${player.roomId} emptied and removed`);
          }
        }
      }
      
      const index = waitingPlayers.indexOf(playerId);
      if (index > -1) {
        waitingPlayers.splice(index, 1);
      }
      
      playerConnections.delete(playerId);
      console.log(`Player ${playerId} disconnected`);
    }

    function startGameLoop(roomId) {
      const room = gameRooms.get(roomId);
      if (!room) return;
      
      const tickRate = 60;
      const interval = setInterval(() => {
        if (!gameRooms.has(roomId)) {
          clearInterval(interval);
          return;
        }
        
        room.update(1000 / tickRate);
        const state = room.getState();
        
        room.getPlayers().forEach(playerId => {
          const conn = playerConnections.get(playerId);
          if (conn && conn.ws.readyState === 1) {
            conn.ws.send(JSON.stringify({
              type: 'GAME_STATE',
              state
            }));
          }
        });
      }, 1000 / tickRate);
    }

    // Start the server
    server.listen(PORT, () => {
      console.log(`Nimbus Arena server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();