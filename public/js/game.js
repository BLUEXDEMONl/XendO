document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    const roomIdSpan = document.getElementById('room-id');
    const shareBtn = document.getElementById('share-btn');
    const backBtn = document.getElementById('back-btn');
    const gameBoard = document.getElementById('game-board');
    const gameStatus = document.getElementById('game-status');
    const gameControls = document.getElementById('game-controls');
    const rematchBtn = document.getElementById('rematch-btn');
    const messageDiv = document.getElementById('message');
    const confetti = document.getElementById('confetti');
    const reactionDisplay = document.getElementById('reaction-display');
    
    const playerXElement = document.getElementById('player-x');
    const playerOElement = document.getElementById('player-o');
    const turnXIndicator = document.getElementById('turn-x');
    const turnOIndicator = document.getElementById('turn-o');
    
    let currentUser = null;
    let gameRoom = null;
    let mySymbol = null;
    let gameActive = false;

    function checkAuth() {
        fetch('/user')
            .then(response => response.json())
            .then(data => {
                if (data.user) {
                    currentUser = data.user;
                    initializeGame();
                } else {
                    window.location.href = '/';
                }
            })
            .catch(() => {
                window.location.href = '/';
            });
    }

    function initializeGame() {
        if (!roomId) {
            showMessage('Invalid room ID', 'error');
            setTimeout(() => {
                window.location.href = '/lobby.html';
            }, 2000);
            return;
        }
        
        roomIdSpan.textContent = roomId;
        socket.emit('join-room', roomId);
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        messageDiv.classList.add('bounce-in');
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
            messageDiv.classList.remove('bounce-in');
        }, 5000);
    }

    function updatePlayerDisplay(room) {
        const playerX = room.players.find(p => p.symbol === 'X');
        const playerO = room.players.find(p => p.symbol === 'O');
        
        if (playerX) {
            playerXElement.querySelector('.player-name').textContent = playerX.username;
            playerXElement.classList.add('connected');
        } else {
            playerXElement.querySelector('.player-name').textContent = 'Searching...';
            playerXElement.classList.remove('connected');
        }
        
        if (playerO) {
            playerOElement.querySelector('.player-name').textContent = playerO.username;
            playerOElement.classList.add('connected');
        } else {
            playerOElement.querySelector('.player-name').textContent = 'Searching...';
            playerOElement.classList.remove('connected');
        }
        
        const currentPlayer = room.players.find(p => p.username === currentUser.username);
        if (currentPlayer) {
            mySymbol = currentPlayer.symbol;
        }
    }

    function updateTurnIndicator(currentTurn) {
        turnXIndicator.classList.toggle('active', currentTurn === 'X');
        turnOIndicator.classList.toggle('active', currentTurn === 'O');
        
        playerXElement.classList.toggle('active', currentTurn === 'X');
        playerOElement.classList.toggle('active', currentTurn === 'O');
    }

    function updateGameBoard(board, winningPattern = null) {
        const cells = gameBoard.querySelectorAll('.cell');
        
        cells.forEach((cell, index) => {
            const value = board[index];
            cell.textContent = value === 'X' ? '❌' : value === 'O' ? '⭕' : '';
            cell.classList.toggle('disabled', value !== null || !gameActive);
            
            if (winningPattern && winningPattern.includes(index)) {
                cell.classList.add('winning');
            } else {
                cell.classList.remove('winning');
            }
        });
    }

    function updateGameStatus(room) {
        let status = '';
        
        switch (room.gameStatus) {
            case 'waiting':
                status = '🔍 Searching for a worthy opponent...';
                gameActive = false;
                break;
            case 'playing':
                const isMyTurn = room.currentTurn === mySymbol;
                status = isMyTurn ? 
                    `⚡ Your turn! Strike now! (${mySymbol === 'X' ? '❌' : '⭕'})` : 
                    `⏳ Opponent is thinking...`;
                gameActive = true;
                break;
            case 'finished':
                gameActive = false;
                if (room.result.winner === 'draw') {
                    status = "🤝 Epic draw! Both warriors fought valiantly!";
                } else {
                    const winner = room.players.find(p => p.symbol === room.result.winner);
                    const isWinner = winner && winner.username === currentUser.username;
                    status = isWinner ? '🏆 VICTORY IS YOURS! You are the champion!' : `👑 ${winner.username} claims victory!`;
                    
                    if (isWinner) {
                        createConfetti();
                        if (window.saveGameResult) {
                            const opponent = room.players.find(p => p.username !== currentUser.username);
                            window.saveGameResult(opponent ? opponent.username : 'Unknown', 'win');
                        }
                    } else if (room.result.winner !== 'draw') {
                        if (window.saveGameResult) {
                            const opponent = room.players.find(p => p.username !== currentUser.username);
                            window.saveGameResult(opponent ? opponent.username : 'Unknown', 'loss');
                        }
                    } else {
                        if (window.saveGameResult) {
                            const opponent = room.players.find(p => p.username !== currentUser.username);
                            window.saveGameResult(opponent ? opponent.username : 'Unknown', 'draw');
                        }
                    }
                }
                gameControls.style.display = 'block';
                break;
        }
        
        gameStatus.textContent = status;
    }

    function createConfetti() {
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
        
        for (let i = 0; i < 50; i++) {
            const confettiPiece = document.createElement('div');
            confettiPiece.className = 'confetti-piece';
            confettiPiece.style.left = Math.random() * 100 + '%';
            confettiPiece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confettiPiece.style.animationDelay = Math.random() * 3 + 's';
            confetti.appendChild(confettiPiece);
            
            setTimeout(() => {
                confettiPiece.remove();
            }, 3000);
        }
    }

    function handleCellClick(index) {
        if (!gameActive || !gameRoom || gameRoom.currentTurn !== mySymbol || gameRoom.board[index] !== null) {
            return;
        }
        
        socket.emit('make-move', { roomId, position: index });
    }

    function showReaction(username, reaction) {
        const reactionElement = document.createElement('div');
        reactionElement.className = 'reaction-animation';
        reactionElement.textContent = `${username}: ${reaction}`;
        reactionDisplay.appendChild(reactionElement);
        
        setTimeout(() => {
            reactionElement.remove();
        }, 2000);
    }

    checkAuth();

    shareBtn.addEventListener('click', () => {
        const gameUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: 'Join my Tic-Tac-Toe battle!',
                text: `⚔️ Challenge me in an epic battle! Room code: ${roomId}`,
                url: gameUrl
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(gameUrl).then(() => {
                showMessage('🔗 Battle link copied! Share with your friends!', 'success');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = gameUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage('🔗 Battle link copied! Share with your friends!', 'success');
        }
    });

    backBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            window.location.href = '/lobby.html';
        }
    });

    rematchBtn.addEventListener('click', () => {
        socket.emit('rematch', roomId);
        rematchBtn.disabled = true;
        rematchBtn.textContent = 'Waiting for opponent...';
    });

    gameBoard.addEventListener('click', (e) => {
        if (e.target.classList.contains('cell')) {
            const index = parseInt(e.target.dataset.index);
            handleCellClick(index);
        }
    });

    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reaction = btn.dataset.reaction;
            socket.emit('send-reaction', { roomId, reaction });
        });
    });

    socket.on('player-joined', (data) => {
        gameRoom = data.room;
        updatePlayerDisplay(gameRoom);
        showMessage('⚔️ Opponent found! Battle commencing...', 'success');
    });

    socket.on('game-start', (data) => {
        gameRoom = data.room;
        updatePlayerDisplay(gameRoom);
        updateTurnIndicator(gameRoom.currentTurn);
        updateGameBoard(gameRoom.board);
        updateGameStatus(gameRoom);
        showMessage('🚀 Battle has begun! May the best warrior win!', 'success');
    });

    socket.on('move-made', (data) => {
        gameRoom = data.room;
        updateTurnIndicator(gameRoom.currentTurn);
        updateGameBoard(gameRoom.board);
        updateGameStatus(gameRoom);
    });

    socket.on('game-end', (data) => {
        gameRoom = data.room;
        updateGameBoard(gameRoom.board, data.result.pattern);
        updateGameStatus(gameRoom);
        updateTurnIndicator(null);
    });

    socket.on('rematch-start', (data) => {
        gameRoom = data.room;
        updatePlayerDisplay(gameRoom);
        updateTurnIndicator(gameRoom.currentTurn);
        updateGameBoard(gameRoom.board);
        updateGameStatus(gameRoom);
        gameControls.style.display = 'none';
        rematchBtn.disabled = false;
        rematchBtn.textContent = '⚔️ Battle Again';
        showMessage('🔥 New battle initiated! Fight!', 'success');
    });

    socket.on('rematch-request', (data) => {
        showMessage(`⚔️ ${data.username} demands a rematch!`, 'success');
    });

    socket.on('player-disconnected', (data) => {
        gameRoom = data.room;
        updatePlayerDisplay(gameRoom);
        updateGameStatus(gameRoom);
        showMessage('💔 Opponent fled the battlefield. Awaiting their return...', 'error');
    });

    socket.on('reaction-received', (data) => {
        showReaction(data.username, data.reaction);
    });

    socket.on('error', (data) => {
        showMessage(data.message, 'error');
        
        if (data.message === 'Room not found') {
            setTimeout(() => {
                window.location.href = '/lobby.html';
            }, 2000);
        }
    });

    socket.on('disconnect', () => {
        showMessage('⚠️ Connection lost. Attempting to reconnect...', 'error');
        gameActive = false;
    });

    socket.on('connect', () => {
        if (gameRoom) {
            socket.emit('join-room', roomId);
        }
    });
});