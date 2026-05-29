const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Allows connections from client apps
});

// Active game lobbies held in system memory
const lobbies = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Triggered when a player hosts a custom match
    socket.on('host_lobby', (data) => {
        const lobbyId = data.lobbyId || socket.id;
        lobbies.set(lobbyId, {
            hostSocketId: socket.id,
            hostPublicAddress: data.publicAddress // Contains { ip, port } from STUN
        });
        socket.join(lobbyId);
        console.log(`Lobby created: ${lobbyId}`);
    });

    // Triggered when a player attempts to join a lobby via the server browser
    socket.on('join_lobby', (data) => {
        const lobby = lobbies.get(data.lobbyId);
        
        if (lobby) {
            // Send the client's public network identity to the host
            io.to(lobby.hostSocketId).emit('punch_target', {
                peerAddress: data.publicAddress,
                role: 'host'
            });

            // Send the host's public network identity to the client
            socket.emit('punch_target', {
                peerAddress: lobby.hostPublicAddress,
                role: 'client'
            });
            
            console.log(`Matchmaking handshake sent for lobby: ${data.lobbyId}`);
        } else {
            socket.emit('error_message', 'Lobby no longer exists.');
        }
    });

    socket.on('disconnect', () => {
        // Clean up memory if a host disconnects
        for (let [id, lobby] of lobbies.entries()) {
            if (lobby.hostSocketId === socket.id) {
                lobbies.delete(id);
                console.log(`Lobby cleaned up: ${id}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));