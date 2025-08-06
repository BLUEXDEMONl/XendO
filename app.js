const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 7860;

const users = new Map();
const gameRooms = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const sessionMiddleware = session({
  secret: 'tic-tac-toe-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
});

app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (users.has(username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  users.set(username, { password, createdAt: new Date() });
  req.session.user = { username };
  
  res.json({ success: true, message: 'Account created successfully' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.session.user = { username };
  res.json({ success: true, message: 'Login successful' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/user', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  
  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], pattern };
    }
  }
  
  if (board.every(cell => cell !== null)) {
    return { winner: 'draw', pattern: null };
  }
  
  return null;
}

io.on('connection', (socket) => {
  const session = socket.request.session;
  
  if (!session.user) {
    socket.disconnect();
    return;
  }
  
  const username = session.user.username;
  
  socket.on('create-room', () => {
    const roomId = uuidv4().substring(0, 8);
    const room = {
      id: roomId,
      players: [{ username, socketId: socket.id, symbol: 'X' }],
      board: Array(9).fill(null),
      currentTurn: 'X',
      gameStatus: 'waiting',
      createdAt: new Date()
    };
    
    gameRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('room-created', { roomId, room });
  });
  
  socket.on('join-room', (roomId) => {
    const room = gameRooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    if (room.players.some(p => p.username === username)) {
      socket.emit('error', { message: 'You are already in this room' });
      return;
    }
    
    room.players.push({ username, socketId: socket.id, symbol: 'O' });
    room.gameStatus = 'playing';
    
    socket.join(roomId);
    io.to(roomId).emit('player-joined', { room });
    io.to(roomId).emit('game-start', { room });
  });
  
  socket.on('make-move', ({ roomId, position }) => {
    const room = gameRooms.get(roomId);
    
    if (!room || room.gameStatus !== 'playing') {
      socket.emit('error', { message: 'Invalid game state' });
      return;
    }
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', { message: 'You are not in this game' });
      return;
    }
    
    if (player.symbol !== room.currentTurn) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    if (room.board[position] !== null) {
      socket.emit('error', { message: 'Position already taken' });
      return;
    }
    
    room.board[position] = player.symbol;
    room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
    
    const gameResult = checkWinner(room.board);
    
    if (gameResult) {
      room.gameStatus = 'finished';
      room.result = gameResult;
      io.to(roomId).emit('game-end', { room, result: gameResult });
    } else {
      io.to(roomId).emit('move-made', { room, position, symbol: player.symbol });
    }
  });
  
  socket.on('rematch', (roomId) => {
    const room = gameRooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', { message: 'You are not in this game' });
      return;
    }
    
    if (!player.wantsRematch) {
      player.wantsRematch = true;
      
      if (room.players.every(p => p.wantsRematch)) {
        room.board = Array(9).fill(null);
        room.currentTurn = 'X';
        room.gameStatus = 'playing';
        room.result = null;
        room.players.forEach(p => p.wantsRematch = false);
        
        io.to(roomId).emit('rematch-start', { room });
      } else {
        io.to(roomId).emit('rematch-request', { username: player.username });
      }
    }
  });
  
  socket.on('send-reaction', ({ roomId, reaction }) => {
    const room = gameRooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        socket.to(roomId).emit('reaction-received', { 
          username: player.username, 
          reaction 
        });
      }
    }
  });
  
  socket.on('disconnect', () => {
    for (let [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          gameRooms.delete(roomId);
        } else {
          room.gameStatus = 'waiting';
          io.to(roomId).emit('player-disconnected', { room });
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎮 Tic-Tac-Toe server running on port ${PORT}`);
  console.log(`🌐 Access the game at: http://localhost:${PORT}`);
});