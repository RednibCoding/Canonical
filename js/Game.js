// Main game controller

import { Terrain } from './Terrain.js';
import { Worm } from './Worm.js';
import { Projectile } from './Projectile.js';
import { Explosion } from './Explosion.js';
import { AI } from './AI.js';
import { NetworkClient } from './Network.js';
import { randomInt, random, clamp } from './utils.js';

const WORM_NAMES = ['Bob', 'Tim', 'Joe', 'Max', 'Sam', 'Rex', 'Ace', 'Zap', 'Pip', 'Gus'];

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Game state
        this.state = 'menu'; // menu, playing, gameOver
        this.gameMode = 'singleplayer'; // singleplayer, multiplayer
        this.difficulty = 'medium';
        
        // Game objects
        this.terrain = null;
        this.playerWorms = [];
        this.enemyWorms = [];
        this.projectiles = [];
        this.explosions = [];
        
        // Turn management
        this.currentTeam = 'player';
        this.playerWormIndex = 0;
        this.enemyWormIndex = 0;
        this.turnTime = 30;
        this.turnTimer = this.turnTime * 60;
        this.turnState = 'aiming'; // aiming, shooting, waiting
        
        // Input state
        this.mouse = { x: 0, y: 0, down: false, startX: 0, startY: 0 };
        this.power = 0;
        this.aimAngle = 0;
        this.selectedAction = 'attack'; // attack, move, jump
        this.hasActed = false; // Track if player has taken action this turn
        
        // Wind
        this.wind = 0;
        
        // AI
        this.ai = null;
        this.aiAction = null;
        this.aiMoveTimer = 0;
        
        // Multiplayer
        this.network = new NetworkClient();
        this.isMyTurn = false;
        this.myPlayerIndex = 0; // 0 = host (player), 1 = guest (enemy from host perspective)
        this.seed = null;
        this.opponentName = 'Opponent';
        
        // UI elements
        this.uiElements = {
            menu: document.getElementById('menu'),
            menuBackground: document.getElementById('menu-background'),
            mainMenu: document.getElementById('main-menu'),
            difficultyMenu: document.getElementById('difficulty-menu'),
            lobbyMenu: document.getElementById('lobby-menu'),
            waitingRoom: document.getElementById('waiting-room'),
            gameUI: document.getElementById('game-ui'),
            turnInfo: document.getElementById('turn-info'),
            timer: document.getElementById('timer'),
            windInfo: document.getElementById('wind-info'),
            powerBar: document.getElementById('power-bar'),
            gameOver: document.getElementById('game-over'),
            winnerText: document.getElementById('winner-text'),
            actionHint: document.getElementById('action-hint'),
            connectionStatus: document.getElementById('connection-status'),
            gamesContainer: document.getElementById('games-container'),
            playerName: document.getElementById('player-name'),
            roomCodeValue: document.getElementById('room-code-value'),
            playersInRoom: document.getElementById('players-in-room'),
            startGameBtn: document.getElementById('start-game-btn'),
            teamLeft: document.getElementById('team-left'),
            teamRight: document.getElementById('team-right')
        };
        
        this.setupInput();
        this.setupMenuEvents();
        this.setupNetworkEvents();
        this.generateMenuBackground();
    }
    
    generateMenuBackground() {
        const canvas = this.uiElements.menuBackground;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Draw sky gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
        skyGradient.addColorStop(0, '#4a90d9');
        skyGradient.addColorStop(0.6, '#87CEEB');
        skyGradient.addColorStop(1, '#b8e0f0');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Generate terrain using simple sine waves
        const baseHeight = height * 0.55;
        const segments = 60;
        const segmentWidth = width / segments;
        
        // Draw terrain
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, height);
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const y = baseHeight 
                + Math.sin(i * 0.25) * 60 
                + Math.sin(i * 0.6) * 35
                + Math.sin(i * 0.12) * 45;
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        
        // Add grass on top
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const y = baseHeight 
                + Math.sin(i * 0.25) * 60 
                + Math.sin(i * 0.6) * 35
                + Math.sin(i * 0.12) * 45;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Add some clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.drawCloud(ctx, 100, 80, 50);
        this.drawCloud(ctx, 400, 50, 40);
        this.drawCloud(ctx, 700, 100, 60);
        this.drawCloud(ctx, 900, 60, 35);
    }
    
    drawCloud(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    setupMenuEvents() {
        // Main menu buttons
        document.getElementById('singleplayer-btn').addEventListener('click', () => {
            this.gameMode = 'singleplayer';
            this.showMenuSection('difficulty-menu');
        });
        
        document.getElementById('multiplayer-btn').addEventListener('click', () => {
            this.gameMode = 'multiplayer';
            this.showMenuSection('lobby-menu');
            this.connectToServer();
        });
        
        // Back buttons
        document.getElementById('back-to-main').addEventListener('click', () => {
            this.showMenuSection('main-menu');
        });
        
        document.getElementById('back-to-main-mp').addEventListener('click', () => {
            this.network.disconnect();
            this.showMenuSection('main-menu');
        });
        
        // Lobby buttons
        document.getElementById('create-game-btn').addEventListener('click', () => {
            const name = this.uiElements.playerName.value.trim();
            if (name.length < 3) {
                alert('Please enter a name (at least 3 characters)');
                this.uiElements.playerName.focus();
                return;
            }
            this.network.setName(name);
            this.network.createRoom();
        });
        
        document.getElementById('leave-room-btn').addEventListener('click', () => {
            this.network.leaveRoom();
        });
        
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.network.startGame();
        });
    }

    setupNetworkEvents() {
        this.network.onConnected = () => {
            this.uiElements.connectionStatus.textContent = 'Connected';
            this.uiElements.connectionStatus.className = 'connected';
            this.network.getRooms();
        };
        
        this.network.onDisconnected = () => {
            this.uiElements.connectionStatus.textContent = 'Disconnected';
            this.uiElements.connectionStatus.className = 'error';
        };
        
        this.network.onError = (error) => {
            this.uiElements.connectionStatus.textContent = 'Connection error';
            this.uiElements.connectionStatus.className = 'error';
        };
        
        this.network.onRoomList = (rooms) => {
            this.updateRoomList(rooms);
        };
        
        this.network.onRoomCreated = (data) => {
            this.uiElements.roomCodeValue.textContent = data.code;
            this.uiElements.playersInRoom.textContent = 'Waiting for opponent...';
            this.uiElements.startGameBtn.disabled = true;
            this.uiElements.startGameBtn.textContent = 'Waiting for Player...';
            this.seed = data.seed;
            this.myPlayerIndex = 0;
            this.showMenuSection('waiting-room');
        };
        
        this.network.onRoomJoined = (data) => {
            this.uiElements.roomCodeValue.textContent = data.code;
            this.uiElements.playersInRoom.textContent = `Players: ${data.players.join(', ')}`;
            this.uiElements.startGameBtn.disabled = true;
            this.uiElements.startGameBtn.style.display = 'none'; // Only host can start
            this.seed = data.seed;
            this.myPlayerIndex = 1;
            this.showMenuSection('waiting-room');
        };
        
        this.network.onPlayerJoined = (data) => {
            this.uiElements.playersInRoom.textContent = `Players: ${data.players.join(', ')}`;
            this.uiElements.startGameBtn.disabled = !data.canStart;
            if (data.canStart) {
                this.uiElements.startGameBtn.textContent = 'Start Game';
            }
        };
        
        this.network.onPlayerLeft = (data) => {
            this.uiElements.playersInRoom.textContent = `Players: ${data.players.join(', ')}`;
            this.uiElements.startGameBtn.disabled = !data.canStart;
            if (!data.canStart) {
                this.uiElements.startGameBtn.textContent = 'Waiting for Player...';
            }
        };
        
        this.network.onLeftRoom = () => {
            this.uiElements.startGameBtn.style.display = '';
            this.showMenuSection('lobby-menu');
            this.network.getRooms();
        };
        
        this.network.onBecameHost = () => {
            this.uiElements.startGameBtn.style.display = '';
            this.myPlayerIndex = 0;
        };
        
        this.network.onGameStart = (data) => {
            this.startMultiplayer(data);
        };
        
        this.network.onGameAction = (data) => {
            this.handleRemoteAction(data.action);
        };
        
        this.network.onTurnChange = (data) => {
            // Turn change is handled locally, this is for sync
        };
        
        this.network.onGameOver = (data) => {
            if (data.reason === 'Opponent disconnected') {
                this.showGameOver('You Win! (Opponent disconnected)');
            }
        };
    }

    updateRoomList(rooms) {
        const container = this.uiElements.gamesContainer;
        
        if (rooms.length === 0) {
            container.innerHTML = '<div class="no-games">No games available. Create one!</div>';
            return;
        }
        
        container.innerHTML = rooms.map(room => `
            <div class="game-item">
                <div class="game-info">
                    <div class="host-name">${room.hostName}'s Game</div>
                    <div class="player-count">${room.playerCount}/2 players, ${room.spectatorCount} spectators</div>
                </div>
                <div class="game-actions">
                    ${room.playerCount < 2 ? `<button class="join-btn" data-code="${room.code}">Join</button>` : ''}
                    <button class="spectate-btn" data-code="${room.code}" data-spectate="true">Watch</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = this.uiElements.playerName.value.trim();
                if (name.length < 3) {
                    alert('Please enter a name (at least 3 characters)');
                    this.uiElements.playerName.focus();
                    return;
                }
                this.network.setName(name);
                this.network.joinRoom(btn.dataset.code, false);
            });
        });
        
        container.querySelectorAll('.spectate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = this.uiElements.playerName.value.trim();
                if (name.length < 3) {
                    alert('Please enter a name (at least 3 characters)');
                    this.uiElements.playerName.focus();
                    return;
                }
                this.network.setName(name);
                this.network.joinRoom(btn.dataset.code, true);
            });
        });
    }

    async connectToServer() {
        this.uiElements.connectionStatus.textContent = 'Connecting...';
        this.uiElements.connectionStatus.className = '';
        
        try {
            await this.network.connect();
        } catch (error) {
            this.uiElements.connectionStatus.textContent = 'Failed to connect';
            this.uiElements.connectionStatus.className = 'error';
        }
    }

    showMenuSection(sectionId) {
        ['main-menu', 'difficulty-menu', 'lobby-menu', 'waiting-room'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== sectionId);
        });
    }

    setupInput() {
        // Mouse events - mousedown on canvas, but move/up on document for extended aiming
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        
        // Bind these so we can add/remove them
        this.boundPointerMove = (e) => this.handlePointerMove(e);
        this.boundPointerUp = (e) => this.handlePointerUp(e);
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handlePointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handlePointerUp(e.changedTouches[0]);
        });
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Action buttons
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.canAct()) return;
                this.selectAction(btn.dataset.action);
            });
        });

        // Menu buttons
        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.difficulty = btn.dataset.difficulty;
                this.start();
            });
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.showMenu();
        });
        
        document.getElementById('surrender-btn').addEventListener('click', () => {
            this.surrender();
        });
    }

    surrender() {
        // In multiplayer, notify the server
        if (this.gameMode === 'multiplayer' && this.network.isConnected()) {
            this.network.send({ type: 'surrender' });
        }
        
        // Return to menu
        this.showMenu();
    }

    selectAction(action) {
        this.selectedAction = action;
        
        // Update button states
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.action === action);
        });
        
        // Update hint text
        const hints = {
            attack: 'Drag to aim & shoot',
            move: 'Click left/right to move',
            jump: 'Click to jump in direction'
        };
        this.uiElements.actionHint.textContent = hints[action];
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    handlePointerDown(e) {
        if (this.state !== 'playing' || !this.canAct() || this.turnState !== 'aiming') return;
        
        const pos = this.getCanvasPos(e);
        const worm = this.getCurrentWorm();
        if (!worm || !worm.alive || !worm.grounded) return;
        
        this.mouse.down = true;
        this.mouse.startX = pos.x;
        this.mouse.startY = pos.y;
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        
        // Handle immediate actions (move, jump)
        if (this.selectedAction === 'move') {
            const direction = pos.x > worm.x ? 1 : -1;
            worm.startAutoMove(direction, 60); // Move 60 pixels
            this.turnState = 'moving'; // End turn after movement
            
            // Send to network in multiplayer
            if (this.gameMode === 'multiplayer') {
                this.network.sendAction({ type: 'move', direction, distance: 60 });
            }
        } else if (this.selectedAction === 'jump') {
            const direction = pos.x > worm.x ? 1 : -1;
            worm.jump(direction);
            this.turnState = 'moving'; // End turn after jump lands
            
            // Send to network in multiplayer
            if (this.gameMode === 'multiplayer') {
                this.network.sendAction({ type: 'jump', direction });
            }
        } else if (this.selectedAction === 'attack') {
            // Add document-level listeners for aiming outside canvas
            document.addEventListener('mousemove', this.boundPointerMove);
            document.addEventListener('mouseup', this.boundPointerUp);
        }
    }

    handlePointerMove(e) {
        const pos = this.getCanvasPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        
        if (!this.mouse.down) return;
        if (this.state !== 'playing' || !this.canAct() || this.turnState !== 'aiming') return;
        
        const worm = this.getCurrentWorm();
        if (!worm || !worm.alive) return;
        
        if (this.selectedAction === 'attack') {
            // Calculate aim angle and power based on drag
            const dx = this.mouse.startX - this.mouse.x;
            const dy = this.mouse.startY - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Power based on drag distance (max at 150px)
            this.power = clamp(dist / 150, 0, 1);
            
            // Angle points opposite to drag (slingshot style)
            if (dist > 10) {
                this.aimAngle = Math.atan2(dy, dx);
                // Clamp to upper hemisphere
                this.aimAngle = clamp(this.aimAngle, -Math.PI, 0);
                worm.aimAngle = this.aimAngle;
                worm.facingRight = dx > 0;
                
                // Send aim updates in multiplayer (throttled)
                if (this.gameMode === 'multiplayer') {
                    if (!this.lastAimUpdate || Date.now() - this.lastAimUpdate > 50) {
                        this.network.sendAction({ 
                            type: 'aim', 
                            angle: this.aimAngle,
                            facingRight: worm.facingRight
                        });
                        this.lastAimUpdate = Date.now();
                    }
                }
            }
        }
    }

    handlePointerUp(e) {
        if (!this.mouse.down) return;
        
        if (this.state === 'playing' && this.canAct() && this.turnState === 'aiming') {
            if (this.selectedAction === 'attack' && this.power > 0.1) {
                // Send to network before shooting in multiplayer
                if (this.gameMode === 'multiplayer') {
                    const worm = this.getCurrentWorm();
                    this.network.sendAction({ 
                        type: 'shoot', 
                        angle: worm.aimAngle, 
                        power: this.power 
                    });
                }
                this.shoot();
            }
        }
        
        // Remove document-level listeners
        document.removeEventListener('mousemove', this.boundPointerMove);
        document.removeEventListener('mouseup', this.boundPointerUp);
        
        this.mouse.down = false;
        this.power = 0;
    }

    handlePointerCancel(e) {
        // No longer used - aiming continues outside canvas
    }

    showMenu() {
        this.state = 'menu';
        this.uiElements.menu.classList.remove('hidden');
        this.uiElements.menuBackground.classList.remove('hidden');
        this.uiElements.gameUI.classList.add('hidden');
        this.uiElements.gameOver.classList.add('hidden');
        this.showMenuSection('main-menu');
        
        // Disconnect from server if in multiplayer
        if (this.gameMode === 'multiplayer') {
            this.network.disconnect();
        }
    }

    updateTeamLabels() {
        const leftLabel = this.uiElements.teamLeft;
        const rightLabel = this.uiElements.teamRight;
        
        if (this.gameMode === 'singleplayer') {
            // Single player: You vs CPU
            leftLabel.querySelector('.team-name').textContent = 'You';
            rightLabel.querySelector('.team-name').textContent = 'CPU';
        } else {
            // Multiplayer: Show player names
            const myName = this.network.playerName || 'You';
            const theirName = this.opponentName || 'Opponent';
            
            if (this.myPlayerIndex === 0) {
                // I'm player 1 (green/left)
                leftLabel.querySelector('.team-name').innerHTML = `${myName} <span class="team-you-badge">YOU</span>`;
                rightLabel.querySelector('.team-name').textContent = theirName;
            } else {
                // I'm player 2 (red/right)
                leftLabel.querySelector('.team-name').textContent = theirName;
                rightLabel.querySelector('.team-name').innerHTML = `${myName} <span class="team-you-badge">YOU</span>`;
            }
        }
        
        // Update active turn indicator
        this.updateActiveTurnIndicator();
    }
    
    updateActiveTurnIndicator() {
        const leftLabel = this.uiElements.teamLeft;
        const rightLabel = this.uiElements.teamRight;
        
        // Left is always green (player in SP, player1 in MP)
        // Right is always red (enemy in SP, player2 in MP)
        const isLeftActive = this.currentTeam === 'player';
        
        leftLabel.classList.toggle('is-active', isLeftActive);
        rightLabel.classList.toggle('is-active', !isLeftActive);
    }

    start() {
        this.gameMode = 'singleplayer';
        this.state = 'playing';
        this.uiElements.menu.classList.add('hidden');
        this.uiElements.menuBackground.classList.add('hidden');
        this.uiElements.gameUI.classList.remove('hidden');
        this.uiElements.gameOver.classList.add('hidden');
        
        // Initialize game
        this.terrain = new Terrain(this.width, this.height);
        this.playerWorms = [];
        this.enemyWorms = [];
        this.projectiles = [];
        this.explosions = [];
        
        // Spawn worms
        this.spawnWorms();
        
        // Initialize AI
        this.ai = new AI(this.difficulty);
        
        // Update team labels
        this.updateTeamLabels();
        
        // Start first turn
        this.currentTeam = 'player';
        this.playerWormIndex = 0;
        this.enemyWormIndex = 0;
        this.startTurn();
        
        // Random wind
        this.wind = random(-5, 5);
        this.updateWindDisplay();
    }

    startMultiplayer(data) {
        this.gameMode = 'multiplayer';
        this.state = 'playing';
        this.uiElements.menu.classList.add('hidden');
        this.uiElements.menuBackground.classList.add('hidden');
        this.uiElements.gameUI.classList.remove('hidden');
        this.uiElements.gameOver.classList.add('hidden');
        
        // Use seeded random for consistent terrain
        this.seed = data.seed;
        
        // Initialize game with seed
        this.terrain = new Terrain(this.width, this.height, this.seed);
        this.playerWorms = [];
        this.enemyWorms = [];
        this.projectiles = [];
        this.explosions = [];
        
        // Spawn worms with seed
        this.spawnWormsSeeded(this.seed);
        
        // No AI in multiplayer
        this.ai = null;
        
        // Determine whose turn it is
        // Player 0 (host) controls 'player' team, Player 1 controls 'enemy' team
        this.currentTeam = 'player';
        this.playerWormIndex = 0;
        this.enemyWormIndex = 0;
        
        // Check if it's my turn
        this.isMyTurn = (this.myPlayerIndex === 0);
        
        // Get opponent name from player list
        if (data.players && data.players.length >= 2) {
            const opponentIndex = this.myPlayerIndex === 0 ? 1 : 0;
            this.opponentName = data.players[opponentIndex].name;
        }
        
        // Update team labels
        this.updateTeamLabels();
        
        this.startTurn();
        
        // Use seeded wind
        const seededRandom = this.seededRandom(this.seed + 1);
        this.wind = (seededRandom() - 0.5) * 10;
        this.updateWindDisplay();
    }

    // Simple seeded random number generator
    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    spawnWormsSeeded(seed) {
        const rng = this.seededRandom(seed);
        const usedNames = [];
        const getName = () => {
            const available = WORM_NAMES.filter(n => !usedNames.includes(n));
            const idx = Math.floor(rng() * available.length);
            const name = available[idx];
            usedNames.push(name);
            return name;
        };

        const minDistance = 50;
        const allWorms = [];

        const findValidPosition = (minX, maxX) => {
            let attempts = 0;
            while (attempts < 50) {
                const x = Math.floor(rng() * (maxX - minX)) + minX;
                const y = this.terrain.getGroundLevel(x);
                
                if (y < this.height - 50) {
                    let tooClose = false;
                    for (const w of allWorms) {
                        const dist = Math.sqrt((w.x - x) ** 2 + (w.y - y) ** 2);
                        if (dist < minDistance) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (!tooClose) {
                        return { x, y };
                    }
                }
                attempts++;
            }
            const x = Math.floor(rng() * (maxX - minX)) + minX;
            return { x, y: this.terrain.getGroundLevel(x) };
        };

        // Spawn player worms on left side
        for (let i = 0; i < 5; i++) {
            const pos = findValidPosition(50, this.width * 0.4);
            const worm = new Worm(pos.x, pos.y, 'player', getName());
            this.playerWorms.push(worm);
            allWorms.push(worm);
        }

        // Spawn enemy worms on right side
        for (let i = 0; i < 5; i++) {
            const pos = findValidPosition(this.width * 0.6, this.width - 50);
            const worm = new Worm(pos.x, pos.y, 'enemy', getName());
            this.enemyWorms.push(worm);
            allWorms.push(worm);
        }
    }

    handleRemoteAction(action) {
        // Handle actions from the remote player
        const worm = this.getCurrentWorm();
        if (!worm || !worm.alive) return;
        
        switch (action.type) {
            case 'move':
                worm.startAutoMove(action.direction, action.distance || 60);
                this.turnState = 'moving';
                break;
            case 'jump':
                worm.jump(action.direction);
                this.turnState = 'moving';
                break;
            case 'aim':
                // Update worm's aim direction for visual feedback
                worm.aimAngle = action.angle;
                worm.facingRight = action.facingRight;
                break;
            case 'shoot':
                worm.aimAngle = action.angle;
                this.power = action.power;
                this.shoot();
                break;
        }
    }

    // Check if current player can act (for multiplayer)
    canAct() {
        if (this.gameMode === 'singleplayer') {
            return this.currentTeam === 'player';
        } else {
            // In multiplayer, check if it's my turn based on which team is active
            const isPlayerTeamTurn = this.currentTeam === 'player';
            return (this.myPlayerIndex === 0 && isPlayerTeamTurn) || 
                   (this.myPlayerIndex === 1 && !isPlayerTeamTurn);
        }
    }

    spawnWorms() {
        const usedNames = [];
        const getName = () => {
            const available = WORM_NAMES.filter(n => !usedNames.includes(n));
            const name = available[randomInt(0, available.length - 1)];
            usedNames.push(name);
            return name;
        };

        const minDistance = 50; // Minimum distance between worms
        const allWorms = [];

        const findValidPosition = (minX, maxX) => {
            let attempts = 0;
            while (attempts < 50) {
                const x = randomInt(minX, maxX);
                const y = this.terrain.getGroundLevel(x);
                
                // Check distance from all existing worms
                let tooClose = false;
                for (const worm of allWorms) {
                    const dist = Math.abs(worm.x - x);
                    if (dist < minDistance) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    return { x, y };
                }
                attempts++;
            }
            // Fallback: just return a position even if overlapping
            const x = randomInt(minX, maxX);
            return { x, y: this.terrain.getGroundLevel(x) };
        };

        // Spawn player worms on left side
        for (let i = 0; i < 5; i++) {
            const pos = findValidPosition(50, this.width * 0.4);
            const worm = new Worm(pos.x, pos.y, 'player', getName());
            this.playerWorms.push(worm);
            allWorms.push(worm);
        }

        // Spawn enemy worms on right side
        for (let i = 0; i < 5; i++) {
            const pos = findValidPosition(this.width * 0.6, this.width - 50);
            const worm = new Worm(pos.x, pos.y, 'enemy', getName());
            this.enemyWorms.push(worm);
            allWorms.push(worm);
        }
    }

    startTurn() {
        this.turnTimer = this.turnTime * 60;
        this.turnState = 'aiming';
        this.power = 0;
        this.mouse.down = false;
        this.hasActed = false;
        
        // Update turn indicator
        this.updateActiveTurnIndicator();
        
        // Reset to attack action if it's my turn
        if (this.canAct()) {
            this.selectAction('attack');
        }
        
        // Change wind slightly each turn
        this.wind += random(-1, 1);
        this.wind = clamp(this.wind, -5, 5);
        this.updateWindDisplay();
        
        // Reset AI (only in singleplayer)
        if (this.gameMode === 'singleplayer' && this.currentTeam === 'enemy') {
            this.ai.reset();
            this.aiAction = null;
            this.aiAimTimer = 0;
        }
        
        // Update UI
        const worm = this.getCurrentWorm();
        if (worm) {
            if (this.gameMode === 'singleplayer') {
                this.uiElements.turnInfo.textContent = 
                    this.currentTeam === 'player' 
                        ? `Your Turn - ${worm.name}`
                        : `Enemy Turn - ${worm.name}`;
            } else {
                // Multiplayer turn info
                const isMyTurn = this.canAct();
                this.uiElements.turnInfo.textContent = isMyTurn 
                    ? `Your Turn - ${worm.name}`
                    : `Opponent's Turn - ${worm.name}`;
            }
        }
    }

    nextTurn() {
        // Advance the current team's worm index to the next alive worm
        const currentWorms = this.currentTeam === 'player' ? this.playerWorms : this.enemyWorms;
        const currentIndex = this.currentTeam === 'player' ? this.playerWormIndex : this.enemyWormIndex;
        
        // Find next alive worm in current team (for next time this team plays)
        for (let i = 1; i <= currentWorms.length; i++) {
            const idx = (currentIndex + i) % currentWorms.length;
            if (currentWorms[idx].alive) {
                if (this.currentTeam === 'player') {
                    this.playerWormIndex = idx;
                } else {
                    this.enemyWormIndex = idx;
                }
                break;
            }
        }
        
        // Switch teams
        this.currentTeam = this.currentTeam === 'player' ? 'enemy' : 'player';
        
        // Make sure the new team's current worm is alive
        const newWorms = this.currentTeam === 'player' ? this.playerWorms : this.enemyWorms;
        let newIndex = this.currentTeam === 'player' ? this.playerWormIndex : this.enemyWormIndex;
        
        // If current worm is dead, find next alive one
        if (!newWorms[newIndex] || !newWorms[newIndex].alive) {
            for (let i = 0; i < newWorms.length; i++) {
                const idx = (newIndex + i) % newWorms.length;
                if (newWorms[idx].alive) {
                    if (this.currentTeam === 'player') {
                        this.playerWormIndex = idx;
                    } else {
                        this.enemyWormIndex = idx;
                    }
                    break;
                }
            }
        }
        
        // Notify network in multiplayer (only the active player notifies)
        if (this.gameMode === 'multiplayer' && this.canAct()) {
            this.network.endTurn();
        }
        
        this.startTurn();
    }

    getCurrentWorm() {
        const worms = this.currentTeam === 'player' ? this.playerWorms : this.enemyWorms;
        const index = this.currentTeam === 'player' ? this.playerWormIndex : this.enemyWormIndex;
        return worms[index];
    }

    shoot() {
        if (this.turnState !== 'aiming') return;
        
        const worm = this.getCurrentWorm();
        if (!worm || !worm.alive) return;
        
        const speed = this.power * 15;
        const vx = Math.cos(worm.aimAngle) * speed;
        const vy = Math.sin(worm.aimAngle) * speed;
        
        const projectile = new Projectile(
            worm.x + Math.cos(worm.aimAngle) * 20,
            worm.y - 12 + Math.sin(worm.aimAngle) * 20,
            vx,
            vy
        );
        
        this.projectiles.push(projectile);
        this.turnState = 'shooting';
        this.power = 0;
    }

    handleExplosion(x, y, radius, damage) {
        // Create visual effect
        this.explosions.push(new Explosion(x, y, radius));
        
        // Destroy terrain
        this.terrain.destroy(x, y, radius);
        
        // Damage and push worms
        const allWorms = [...this.playerWorms, ...this.enemyWorms];
        for (const worm of allWorms) {
            if (!worm.alive) continue;
            
            const dist = Math.sqrt((worm.x - x) ** 2 + (worm.y - y) ** 2);
            if (dist < radius + 20) {
                // Calculate damage based on distance
                const damageFactor = 1 - (dist / (radius + 20));
                const actualDamage = Math.floor(damage * damageFactor);
                worm.takeDamage(actualDamage);
                
                // Apply knockback
                const knockback = (1 - dist / (radius + 20)) * 10;
                worm.applyExplosionForce(x, y, knockback);
            }
        }
    }

    checkGameOver() {
        const playerAlive = this.playerWorms.some(w => w.alive);
        const enemyAlive = this.enemyWorms.some(w => w.alive);
        
        if (!playerAlive || !enemyAlive) {
            this.state = 'gameOver';
            this.uiElements.gameOver.classList.remove('hidden');
            
            let winMessage;
            if (this.gameMode === 'singleplayer') {
                winMessage = playerAlive ? 'You Win!' : 'Enemy Wins!';
            } else {
                // Multiplayer
                const iWon = (this.myPlayerIndex === 0 && playerAlive) || 
                             (this.myPlayerIndex === 1 && enemyAlive);
                winMessage = iWon ? 'You Win!' : 'You Lose!';
                
                // Notify server
                if (playerAlive) {
                    this.network.sendGameOver('player');
                } else {
                    this.network.sendGameOver('enemy');
                }
            }
            
            this.uiElements.winnerText.textContent = winMessage;
            return true;
        }
        return false;
    }
    
    showGameOver(message) {
        this.state = 'gameOver';
        this.uiElements.gameOver.classList.remove('hidden');
        this.uiElements.winnerText.textContent = message;
    }

    updateWindDisplay() {
        const direction = this.wind > 0 ? '→' : '←';
        const strength = Math.abs(this.wind).toFixed(1);
        this.uiElements.windInfo.textContent = `Wind: ${direction} ${strength}`;
    }

    update() {
        if (this.state !== 'playing') return;

        // Update all worms physics
        const allWorms = [...this.playerWorms, ...this.enemyWorms];
        for (const worm of allWorms) {
            worm.update(this.terrain, allWorms);
        }

        // Update projectiles
        for (const proj of this.projectiles) {
            proj.update(this.terrain, this.wind);
            
            // Check for worm collision
            proj.checkWormCollision(allWorms);
            
            if (proj.shouldExplode()) {
                this.handleExplosion(proj.x, proj.y, proj.explosionRadius, proj.damage);
                proj.active = false;
            }
        }
        this.projectiles = this.projectiles.filter(p => p.active);

        // Update explosions
        for (const exp of this.explosions) {
            exp.update();
        }
        this.explosions = this.explosions.filter(e => e.active);

        // Turn management
        if (this.turnState === 'shooting') {
            // Wait for projectiles and physics to settle
            const allSettled = this.projectiles.length === 0 && 
                              this.explosions.length === 0 &&
                              allWorms.every(w => !w.alive || w.grounded);
            
            if (allSettled) {
                this.turnState = 'waiting';
                setTimeout(() => {
                    if (!this.checkGameOver()) {
                        this.nextTurn();
                    }
                }, 500);
            }
        } else if (this.turnState === 'moving') {
            // Wait for movement/jump to complete
            const worm = this.getCurrentWorm();
            const isSettled = worm && worm.grounded && !worm.isMoving();
            
            if (isSettled) {
                this.turnState = 'waiting';
                setTimeout(() => {
                    if (!this.checkGameOver()) {
                        this.nextTurn();
                    }
                }, 300);
            }
        } else if (this.turnState === 'aiming') {
            const worm = this.getCurrentWorm();
            
            if (this.canAct()) {
                // My turn - update power bar
                this.uiElements.powerBar.style.width = `${this.power * 100}%`;
            } else if (this.gameMode === 'singleplayer' && this.currentTeam === 'enemy') {
                // AI turn (singleplayer only)
                this.handleAI(worm);
            }
            // In multiplayer when it's not my turn, we just wait for network actions
            
            // Turn timer
            this.turnTimer--;
            this.uiElements.timer.textContent = Math.ceil(this.turnTimer / 60);
            
            if (this.turnTimer <= 0) {
                // Time's up - skip turn
                this.nextTurn();
            }
        }
    }

    handleAI(worm) {
        if (!worm || !worm.alive) {
            this.nextTurn();
            return;
        }

        // Wait for worm to be grounded before acting
        if (!worm.grounded) return;

        const action = this.ai.update(worm, this.playerWorms, this.terrain, this.wind);
        
        if (!action) return;

        if (action.type === 'move') {
            // Use auto-move system
            worm.startAutoMove(action.direction, 60);
            this.turnState = 'moving';
        } else if (action.type === 'jump') {
            worm.jump(action.direction);
            this.turnState = 'moving';
        } else if (action.type === 'shoot') {
            // Track aiming time to prevent getting stuck
            if (!this.aiAimTimer) this.aiAimTimer = 0;
            this.aiAimTimer++;
            
            // Aim towards target angle
            const aimDiff = action.angle - worm.aimAngle;
            
            // Fire if aimed well enough OR if we've been aiming too long (2 seconds)
            if (Math.abs(aimDiff) <= 0.1 || this.aiAimTimer > 120) {
                // Fire!
                this.power = action.power;
                this.aiAimTimer = 0;
                this.shoot();
            } else {
                // Adjust aim towards target - larger steps for faster aiming
                const aimStep = Math.min(0.08, Math.abs(aimDiff));
                worm.aim(Math.sign(aimDiff) * aimStep);
            }
        } else if (action.type === 'wait') {
            // Skip turn
            this.nextTurn();
        }
    }

    draw() {
        const ctx = this.ctx;
        
        // Clear with sky gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.height);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#E0F6FF');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw clouds
        this.drawClouds(ctx);
        
        // Draw terrain
        if (this.terrain) {
            this.terrain.draw(ctx);
        }
        
        // Draw worms
        const currentWorm = this.getCurrentWorm();
        for (const worm of this.playerWorms) {
            worm.draw(ctx, worm === currentWorm && this.currentTeam === 'player');
        }
        for (const worm of this.enemyWorms) {
            worm.draw(ctx, worm === currentWorm && this.currentTeam === 'enemy');
        }
        
        // Draw projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx);
        }
        
        // Draw explosions
        for (const exp of this.explosions) {
            exp.draw(ctx);
        }
        
        // Draw aiming trajectory when dragging (show for whoever can act)
        if (this.mouse.down && this.power > 0.1 && this.canAct()) {
            this.drawTrajectory(ctx);
        }
    }

    drawTrajectory(ctx) {
        const worm = this.getCurrentWorm();
        if (!worm) return;
        
        const speed = this.power * 15;
        const vx = Math.cos(worm.aimAngle) * speed;
        const vy = Math.sin(worm.aimAngle) * speed;
        
        let x = worm.x + Math.cos(worm.aimAngle) * 20;
        let y = worm.y - 12 + Math.sin(worm.aimAngle) * 20;
        let velX = vx;
        let velY = vy;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        // Draw trajectory preview (limited steps)
        for (let i = 0; i < 50; i++) {
            velX += this.wind * 0.01;
            velY += 0.3; // gravity
            x += velX;
            y += velY;
            
            if (x < 0 || x > this.width || y > this.height) break;
            if (this.terrain.isSolid(x, y)) break;
            
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawClouds(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        // Static decorative clouds
        const clouds = [
            { x: 100, y: 50, size: 40 },
            { x: 300, y: 80, size: 50 },
            { x: 600, y: 40, size: 45 },
            { x: 850, y: 70, size: 55 },
        ];
        
        for (const cloud of clouds) {
            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
            ctx.arc(cloud.x + cloud.size * 0.4, cloud.y - 10, cloud.size * 0.4, 0, Math.PI * 2);
            ctx.arc(cloud.x + cloud.size * 0.8, cloud.y, cloud.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}
