document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const usernameSpan = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomCodeInput = document.getElementById('room-code');
    const logoutBtn = document.getElementById('logout-btn');
    const messageDiv = document.getElementById('message');
    const historyList = document.getElementById('history-list');

    let currentUser = null;

    function checkAuth() {
        fetch('/user')
            .then(response => response.json())
            .then(data => {
                if (data.user) {
                    currentUser = data.user;
                    usernameSpan.textContent = data.user.username;
                    userAvatar.textContent = data.user.username.charAt(0).toUpperCase();
                    loadGameHistory();
                } else {
                    window.location.href = '/';
                }
            })
            .catch(() => {
                window.location.href = '/';
            });
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    function setLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function loadGameHistory() {
        const history = JSON.parse(localStorage.getItem('gameHistory') || '[]');
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="no-history">No games played yet</div>';
            return;
        }
        
        historyList.innerHTML = history.map(game => `
            <div class="history-item">
                <div>
                    <strong>vs ${game.opponent}</strong>
                    <div style="font-size: 12px; color: #666;">${game.date}</div>
                </div>
                <div style="font-weight: bold; color: ${game.result === 'win' ? '#28a745' : game.result === 'loss' ? '#dc3545' : '#ffc107'}">
                    ${game.result.toUpperCase()}
                </div>
            </div>
        `).join('');
    }

    function saveGameResult(opponent, result) {
        const history = JSON.parse(localStorage.getItem('gameHistory') || '[]');
        history.unshift({
            opponent,
            result,
            date: new Date().toLocaleDateString()
        });
        
        if (history.length > 10) {
            history.pop();
        }
        
        localStorage.setItem('gameHistory', JSON.stringify(history));
        loadGameHistory();
    }

    checkAuth();

    createRoomBtn.addEventListener('click', () => {
        setLoading(createRoomBtn, true);
        socket.emit('create-room');
    });

    joinRoomBtn.addEventListener('click', () => {
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        
        if (!roomCode) {
            showMessage('Please enter a room code', 'error');
            return;
        }
        
        if (roomCode.length !== 8) {
            showMessage('Room code must be 8 characters long', 'error');
            return;
        }
        
        setLoading(joinRoomBtn, true);
        socket.emit('join-room', roomCode);
    });

    roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoomBtn.click();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            showMessage('Logout failed', 'error');
        }
    });

    socket.on('room-created', (data) => {
        setLoading(createRoomBtn, false);
        showMessage(`Room created! Code: ${data.roomId}`, 'success');
        
        setTimeout(() => {
            window.location.href = `/game.html?room=${data.roomId}`;
        }, 1000);
    });

    socket.on('player-joined', (data) => {
        setLoading(joinRoomBtn, false);
        window.location.href = `/game.html?room=${data.room.id}`;
    });

    socket.on('error', (data) => {
        setLoading(createRoomBtn, false);
        setLoading(joinRoomBtn, false);
        showMessage(data.message, 'error');
    });

    socket.on('disconnect', () => {
        showMessage('Connection lost. Please refresh the page.', 'error');
    });

    window.saveGameResult = saveGameResult;
});