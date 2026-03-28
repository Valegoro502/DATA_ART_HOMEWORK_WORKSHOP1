import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './utils/prisma';
import { hashPassword } from './utils/auth';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import roomsRoutes from './routes/rooms';
import usersRoutes from './routes/users';
import messagesRoutes from './routes/messages';
import adminRoutes from './routes/admin';

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

// Serve uploads using our known absolute path
app.use('/uploads', express.static('/app/uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/admin', adminRoutes);

// make io available to routes
app.set('io', io);

// Auto-seed admin user
async function seedAdmin() {
  try {
    const defaultPassword = await hashPassword('admin');
    await prisma.user.upsert({
      where: { email: 'admin@gmail.com' },
      update: { isGlobalAdmin: true },
      create: {
        email: 'admin@gmail.com',
        username: 'Admin',
        passwordHash: defaultPassword,
        isGlobalAdmin: true
      }
    });
    console.log('Global admin seeded properly.');
  } catch (e) {
    console.error('Failed to seed admin:', e);
  }
}
seedAdmin();

// Socket logic
const activeUsers = new Map<string, Set<string>>(); // userId -> set of socketIds
const socketToUser = new Map<string, string>(); // socketId -> userId
const socketStatus = new Map<string, 'active' | 'afk'>(); // socketId -> status

function getAggregatedStatus(userId: string): 'active' | 'afk' | 'offline' {
  const socketIds = activeUsers.get(userId);
  if (!socketIds || socketIds.size === 0) return 'offline';

  let allAfk = true;
  for (const sid of socketIds) {
    if (socketStatus.get(sid) === 'active') {
      allAfk = false;
      break;
    }
  }
  return allAfk ? 'afk' : 'active';
}

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
  socketStatus.set(socket.id, 'active'); // Default to active on first connect

  // Broadcast presence
  io.emit('user:presence', { userId, status: 'active' });

  // Join user's rooms for events
  prisma.roomMember.findMany({ where: { userId } }).then(memberships => {
    memberships.forEach(m => socket.join(`room:${m.roomId}`));
  });

  // Personal message channel
  socket.join(`user:${userId}`);

  // Heartbeat / AFK handling
  socket.on('presence:ping', (status: 'active' | 'afk') => {
    const oldStatus = getAggregatedStatus(userId);
    socketStatus.set(socket.id, status);
    const newStatus = getAggregatedStatus(userId);

    if (oldStatus !== newStatus) {
      io.emit('user:presence', { userId, status: newStatus });
    }
  });

  socket.on('disconnect', () => {
    const set = activeUsers.get(userId);
    if (set) {
      const oldStatus = getAggregatedStatus(userId);
      set.delete(socket.id);
      socketStatus.delete(socket.id);
      
      const newStatus = getAggregatedStatus(userId);
      if (newStatus !== oldStatus) {
        io.emit('user:presence', { userId, status: newStatus });
      }

      if (set.size === 0) {
        activeUsers.delete(userId);
      }
    }
    socketToUser.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
