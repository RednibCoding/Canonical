// Network client for multiplayer

export class NetworkClient {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.roomCode = null;
        this.isHost = false;
        this.isSpectator = false;
        this.playerName = 'Player';
        this.connected = false;
        
        // Event callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onError = null;
        this.onRoomList = null;
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onLeftRoom = null;
        this.onBecameHost = null;
        this.onGameStart = null;
        this.onGameAction = null;
        this.onTurnChange = null;
        this.onGameOver = null;
    }

    connect(serverUrl = null) {
        // Production server URL - change this to your server's address
        if (!serverUrl) {
            // For production: use your server's domain or IP
            // serverUrl = 'wss://your-domain.com:8080';
            serverUrl = 'wss://185.163.119.178:8080';
        }
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(serverUrl);
                
                this.ws.onopen = () => {
                    console.log('Connected to server');
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from server');
                    this.connected = false;
                    this.clientId = null;
                    this.roomCode = null;
                    if (this.onDisconnected) this.onDisconnected();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    if (this.onError) this.onError(error);
                    reject(error);
                };
                
                // Wait for connected message
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 5000);
                
                this._connectResolve = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.clientId = message.clientId;
                this.connected = true;
                if (this._connectResolve) {
                    this._connectResolve();
                    this._connectResolve = null;
                }
                if (this.onConnected) this.onConnected();
                break;
                
            case 'nameSet':
                this.playerName = message.name;
                break;
                
            case 'roomList':
                if (this.onRoomList) this.onRoomList(message.rooms);
                break;
                
            case 'roomCreated':
                this.roomCode = message.code;
                this.isHost = message.isHost;
                this.seed = message.seed;
                if (this.onRoomCreated) this.onRoomCreated(message);
                break;
                
            case 'roomJoined':
                this.roomCode = message.code;
                this.isHost = message.isHost;
                this.isSpectator = message.isSpectator;
                this.seed = message.seed;
                if (this.onRoomJoined) this.onRoomJoined(message);
                break;
                
            case 'playerJoined':
                if (this.onPlayerJoined) this.onPlayerJoined(message);
                break;
                
            case 'playerLeft':
                if (this.onPlayerLeft) this.onPlayerLeft(message);
                break;
                
            case 'leftRoom':
                this.roomCode = null;
                this.isHost = false;
                this.isSpectator = false;
                if (this.onLeftRoom) this.onLeftRoom();
                break;
                
            case 'becameHost':
                this.isHost = true;
                if (this.onBecameHost) this.onBecameHost();
                break;
                
            case 'gameStart':
                if (this.onGameStart) this.onGameStart(message);
                break;
                
            case 'gameAction':
                if (this.onGameAction) this.onGameAction(message);
                break;
                
            case 'turnChange':
                if (this.onTurnChange) this.onTurnChange(message);
                break;
                
            case 'gameOver':
                if (this.onGameOver) this.onGameOver(message);
                break;
                
            case 'error':
                console.error('Server error:', message.message);
                if (this.onError) this.onError(new Error(message.message));
                break;
        }
    }

    // API methods
    setName(name) {
        this.playerName = name;
        this.send({ type: 'setName', name });
    }

    getRooms() {
        this.send({ type: 'getRooms' });
    }

    createRoom() {
        this.send({ type: 'createRoom' });
    }

    joinRoom(code, asSpectator = false) {
        this.send({ type: 'joinRoom', code, asSpectator });
    }

    leaveRoom() {
        this.send({ type: 'leaveRoom' });
    }

    startGame() {
        this.send({ type: 'startGame' });
    }

    sendAction(action) {
        this.send({ type: 'gameAction', action });
    }

    endTurn() {
        this.send({ type: 'endTurn' });
    }

    sendGameOver(winner) {
        this.send({ type: 'gameOver', winner });
    }
}
