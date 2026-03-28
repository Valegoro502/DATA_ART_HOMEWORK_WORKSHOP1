import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './utils/prisma';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import roomsRoutes from './routes/rooms';
import usersRoutes from './routes/users';
import messagesRoutes from './routes/messages';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);

// make io available to routes
app.set('io', io);

// Socket logic
const activeUsers = new Map<string, Set<string>>(); // userId -> set of socketIds
const socketToUser = new Map<string, string>(); // socketId -> userId

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    // Simplistic check: verify token via DB session.
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });
    
    if (!session) return next(new Error('Session invalid'));
    
    socket.data.userId = session.user.id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId;
  socketToUser.set(socket.id, userId);
  
  if (!activeUsers.has(userId)) activeUsers.set(userId, new Set());
  activeUsers.get(userId)!.add(socket.id);

  // Broadcast presence
  io.emit('user:presence', { userId, status: 'online' });

  // Join user's rooms for events
  prisma.roomMember.findMany({ where: { userId } }).then(memberships => {
    memberships.forEach(m => socket.join(`room:${m.roomId}`));
  });

  // Personal message channel
  socket.join(`user:${userId}`);

  // Heartbeat / AFK handling
  let pingTimeout: NodeJS.Timeout;
  socket.on('presence:ping', (status: 'active' | 'afk') => {
    // Collect status from all sockets to find max status for user
    // Very simplified logic here for assignment demonstration.
    io.emit('user:presence', { userId, status });
  });

  socket.on('disconnect', () => {
    const set = activeUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        activeUsers.delete(userId);
        io.emit('user:presence', { userId, status: 'offline' });
      }
    }
    socketToUser.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
