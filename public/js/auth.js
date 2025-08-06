document.addEventListener('DOMContentLoaded', function() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const messageDiv = document.getElementById('message');

    function checkAuth() {
        fetch('/user')
            .then(response => response.json())
            .then(data => {
                if (data.user) {
                    window.location.href = '/lobby.html';
                }
            })
            .catch(() => {});
    }

    checkAuth();

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
        });
    });

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

    function setLoading(form, loading) {
        const btn = form.querySelector('button[type="submit"]');
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            showMessage('Please fill in all fields', 'error');
            return;
        }
        
        setLoading(loginForm, true);
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/lobby.html';
                }, 1000);
            } else {
                showMessage(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        } finally {
            setLoading(loginForm, false);
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;
        
        if (!username || !password) {
            showMessage('Please fill in all fields', 'error');
            return;
        }
        
        if (username.length < 3) {
            showMessage('Username must be at least 3 characters long', 'error');
            return;
        }
        
        if (password.length < 6) {
            showMessage('Password must be at least 6 characters long', 'error');
            return;
        }
        
        setLoading(signupForm, true);
        
        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('🎉 Welcome to the arena! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/lobby.html';
                }, 1000);
            } else {
                showMessage(data.error || 'Signup failed', 'error');
            }
        } catch (error) {
            showMessage('⚠️ Connection error. Please try again.', 'error');
        } finally {
            setLoading(signupForm, false);
        }
    });

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const form = input.closest('form');
                if (form) {
                    form.dispatchEvent(new Event('submit'));
                }
            }
        });
    });
});