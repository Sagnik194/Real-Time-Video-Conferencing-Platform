import { Server } from 'socket.io';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_ROOM_MESSAGES = 200;

export const connectToSocket = (server) => {
    const defaultOrigins = ['https://real-time-video-conferencing-platform-de4t.onrender.com', 'http://localhost:3000'];
    const allowedOrigins = (process.env.CLIENT_ORIGIN || defaultOrigins.join(',')).split(',').map(value => value.trim()).filter(Boolean);
    const io = new Server(server, {
        cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
        maxHttpBufferSize: 1e6,
    });
    const roomMessages = new Map();

    io.on('connection', socket => {
        let currentRoom = null;
        socket.on('join-call', rawRoom => {
            const room = typeof rawRoom === 'string' ? rawRoom.trim().slice(0, 128) : '';
            if (!room) return socket.emit('meeting-error', 'Invalid meeting code.');
            if (currentRoom) socket.leave(currentRoom);
            currentRoom = room;
            const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
            socket.join(room);
            for (const clientId of [...clients, socket.id]) io.to(clientId).emit('user-joined', socket.id, [...clients, socket.id]);
            for (const item of roomMessages.get(room) || []) socket.emit('chat-message', item.data, item.sender, item.socketId);
        });
        socket.on('signal', (toId, payload) => {
            if (!currentRoom || typeof toId !== 'string' || !payload || typeof payload !== 'object') return;
            if (io.sockets.adapter.rooms.get(currentRoom)?.has(toId)) io.to(toId).emit('signal', socket.id, payload);
        });
        socket.on('chat-message', (rawText, rawSender) => {
            if (!currentRoom || typeof rawText !== 'string') return;
            const data = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
            if (!data) return;
            const sender = typeof rawSender === 'string' ? rawSender.trim().slice(0, 80) || 'Guest' : 'Guest';
            const history = roomMessages.get(currentRoom) || [];
            history.push({ data, sender, socketId: socket.id });
            if (history.length > MAX_ROOM_MESSAGES) history.splice(0, history.length - MAX_ROOM_MESSAGES);
            roomMessages.set(currentRoom, history);
            io.to(currentRoom).emit('chat-message', data, sender, socket.id);
        });
        socket.on('disconnect', () => {
            if (currentRoom) {
                socket.to(currentRoom).emit('user-left', socket.id);
                if (!(io.sockets.adapter.rooms.get(currentRoom)?.size)) roomMessages.delete(currentRoom);
            }
        });
    });
    return io;
};
