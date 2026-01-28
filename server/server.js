// Canonical Multiplayer Server
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Game rooms storage
const rooms = new Map();
const clients = new Map();

// Generate a short room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Generate unique client ID
function generateClientId() {
    return Math.random().toString(36).substr(2, 9);
}

// Broadcast to all clients in a room
function broadcastToRoom(roomCode, message, excludeClient = null) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const msgStr = JSON.stringify(message);
    [...room.players, ...room.spectators].forEach(clientId => {
        if (clientId !== excludeClient) {
            const client = clients.get(clientId);
            if (client && client.ws.readyState === 1) {
                client.ws.send(msgStr);
            }
        }
    });
}

// Send room list to all clients not in a room
function broadcastRoomList() {
    const roomList = [];
    rooms.forEach((room, code) => {
        if (room.state === 'waiting') {
            roomList.push({
                code,
                hostName: room.hostName,
                playerCount: room.players.length,
                spectatorCount: room.spectators.length
            });
        }
    });
    
    const message = JSON.stringify({ type: 'roomList', rooms: roomList });
    clients.forEach(client => {
        if (!client.roomCode && client.ws.readyState === 1) {
            client.ws.send(message);
        }
    });
}

// Handle incoming messages
function handleMessage(clientId, data) {
    const client = clients.get(clientId);
    if (!client) return;
    
    let message;
    try {
        message = JSON.parse(data);
    } catch (e) {
        console.error('Invalid JSON:', data);
        return;
    }
    
    switch (message.type) {
        case 'setName':
            const nameInput = (message.name || '').substring(0, 12).trim();
            if (nameInput.length < 3) {
                send(client.ws, { type: 'error', message: 'Name must be at least 3 characters' });
                return;
            }
            client.name = nameInput;
            send(client.ws, { type: 'nameSet', name: client.name });
            break;
            
        case 'getRooms':
            const roomList = [];
            rooms.forEach((room, code) => {
                if (room.state === 'waiting') {
                    roomList.push({
                        code,
                        hostName: room.hostName,
                        playerCount: room.players.length,
                        spectatorCount: room.spectators.length
                    });
                }
            });
            send(client.ws, { type: 'roomList', rooms: roomList });
            break;
            
        case 'createRoom':
            if (client.roomCode) {
                send(client.ws, { type: 'error', message: 'Already in a room' });
                return;
            }
            
            let roomCode;
            do {
                roomCode = generateRoomCode();
            } while (rooms.has(roomCode));
            
            const newRoom = {
                code: roomCode,
                hostId: clientId,
                hostName: client.name,
                players: [clientId],
                spectators: [],
                state: 'waiting', // waiting, playing, finished
                gameState: null,
                seed: Math.floor(Math.random() * 1000000)
            };
            
            rooms.set(roomCode, newRoom);
            client.roomCode = roomCode;
            client.isHost = true;
            client.isSpectator = false;
            
            send(client.ws, { 
                type: 'roomCreated', 
                code: roomCode,
                isHost: true,
                seed: newRoom.seed
            });
            broadcastRoomList();
            break;
            
        case 'joinRoom':
            if (client.roomCode) {
                send(client.ws, { type: 'error', message: 'Already in a room' });
                return;
            }
            
            const joinRoom = rooms.get(message.code);
            if (!joinRoom) {
                send(client.ws, { type: 'error', message: 'Room not found' });
                return;
            }
            
            if (message.asSpectator) {
                joinRoom.spectators.push(clientId);
                client.isSpectator = true;
            } else {
                if (joinRoom.players.length >= 2) {
                    send(client.ws, { type: 'error', message: 'Room is full' });
                    return;
                }
                joinRoom.players.push(clientId);
                client.isSpectator = false;
            }
            
            client.roomCode = message.code;
            client.isHost = false;
            
            send(client.ws, { 
                type: 'roomJoined', 
                code: message.code,
                isHost: false,
                isSpectator: client.isSpectator,
                hostName: joinRoom.hostName,
                seed: joinRoom.seed,
                players: joinRoom.players.map(id => clients.get(id)?.name || 'Unknown')
            });
            
            // Notify room members
            broadcastToRoom(message.code, {
                type: 'playerJoined',
                name: client.name,
                isSpectator: client.isSpectator,
                players: joinRoom.players.map(id => clients.get(id)?.name || 'Unknown'),
                canStart: joinRoom.players.length === 2
            }, clientId);
            
            broadcastRoomList();
            break;
            
        case 'leaveRoom':
            leaveRoom(clientId);
            break;
            
        case 'startGame':
            if (!client.isHost || !client.roomCode) return;
            
            const startRoom = rooms.get(client.roomCode);
            if (!startRoom || startRoom.players.length !== 2) {
                send(client.ws, { type: 'error', message: 'Need 2 players to start' });
                return;
            }
            
            startRoom.state = 'playing';
            startRoom.currentTurn = 0; // Player index
            
            broadcastToRoom(client.roomCode, {
                type: 'gameStart',
                players: startRoom.players.map(id => ({
                    id,
                    name: clients.get(id)?.name || 'Unknown'
                })),
                seed: startRoom.seed,
                firstPlayer: 0
            });
            
            broadcastRoomList();
            break;
            
        case 'gameAction':
            // Forward game actions to other players in the room
            if (!client.roomCode) return;
            
            const actionRoom = rooms.get(client.roomCode);
            if (!actionRoom || actionRoom.state !== 'playing') return;
            
            broadcastToRoom(client.roomCode, {
                type: 'gameAction',
                action: message.action,
                playerId: clientId
            }, clientId);
            break;
            
        case 'endTurn':
            if (!client.roomCode) return;
            
            const turnRoom = rooms.get(client.roomCode);
            if (!turnRoom || turnRoom.state !== 'playing') return;
            
            // Switch to next player
            turnRoom.currentTurn = (turnRoom.currentTurn + 1) % 2;
            
            broadcastToRoom(client.roomCode, {
                type: 'turnChange',
                currentPlayer: turnRoom.currentTurn,
                playerName: clients.get(turnRoom.players[turnRoom.currentTurn])?.name
            });
            break;
            
        case 'gameOver':
            if (!client.roomCode) return;
            
            const endRoom = rooms.get(client.roomCode);
            if (!endRoom) return;
            
            endRoom.state = 'finished';
            
            broadcastToRoom(client.roomCode, {
                type: 'gameOver',
                winner: message.winner
            });
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
}

function leaveRoom(clientId) {
    const client = clients.get(clientId);
    if (!client || !client.roomCode) return;
    
    const room = rooms.get(client.roomCode);
    if (!room) {
        client.roomCode = null;
        return;
    }
    
    // Remove from players or spectators
    room.players = room.players.filter(id => id !== clientId);
    room.spectators = room.spectators.filter(id => id !== clientId);
    
    const wasHost = client.isHost;
    const roomCode = client.roomCode;
    
    client.roomCode = null;
    client.isHost = false;
    client.isSpectator = false;
    
    send(client.ws, { type: 'leftRoom' });
    
    // If room is empty, delete it
    if (room.players.length === 0 && room.spectators.length === 0) {
        rooms.delete(roomCode);
    } else {
        // If host left, assign new host
        if (wasHost && room.players.length > 0) {
            const newHostId = room.players[0];
            const newHost = clients.get(newHostId);
            if (newHost) {
                room.hostId = newHostId;
                room.hostName = newHost.name;
                newHost.isHost = true;
                send(newHost.ws, { type: 'becameHost' });
            }
        }
        
        // Notify remaining room members
        broadcastToRoom(roomCode, {
            type: 'playerLeft',
            name: client.name,
            players: room.players.map(id => clients.get(id)?.name || 'Unknown'),
            canStart: room.players.length === 2
        });
        
        // If game was in progress, end it
        if (room.state === 'playing' && room.players.length < 2) {
            room.state = 'finished';
            broadcastToRoom(roomCode, {
                type: 'gameOver',
                winner: 'opponent_left',
                reason: 'Opponent disconnected'
            });
        }
    }
    
    broadcastRoomList();
}

function send(ws, message) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(message));
    }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    const clientId = generateClientId();
    
    clients.set(clientId, {
        id: clientId,
        ws,
        name: 'Player',
        roomCode: null,
        isHost: false,
        isSpectator: false
    });
    
    console.log(`Client connected: ${clientId}`);
    
    // Send welcome message
    send(ws, { type: 'connected', clientId });
    
    ws.on('message', (data) => {
        handleMessage(clientId, data.toString());
    });
    
    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        leaveRoom(clientId);
        clients.delete(clientId);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
    });
});

console.log(`Canonical server running on port ${PORT}`);
