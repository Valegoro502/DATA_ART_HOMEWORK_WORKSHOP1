import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import { getAggregatedStatus } from '../utils/presence';

const router = Router();

// all routes require admin
router.use(authenticate, requireAdmin);

// List users for admin panel
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        globalBanType: true,
        globalBanUntil: true,
        isGlobalAdmin: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const usersWithPresence = users.map(u => ({
      ...u,
      presence: getAggregatedStatus(u.id)
    }));
    
    res.json(usersWithPresence);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Issue Ban
  router.post('/ban', async (req: AuthRequest, res) => {
  try {
    const { userId, type, durationHours } = req.body;
    
    if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    if (type !== 'PERMANENT' && type !== 'PARTIAL') {
      return res.status(400).json({ error: 'Invalid ban type' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isGlobalAdmin) return res.status(403).json({ error: 'Cannot ban another admin' });

    let globalBanUntil = null;
    if (type === 'PARTIAL' && typeof durationHours === 'number' && durationHours > 0) {
        globalBanUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { globalBanType: type, globalBanUntil }
    });

    if (type === 'PERMANENT') {
        // Kick them immediately
        await prisma.session.deleteMany({ where: { userId } });
        // Can also trigger a socket event to force disconnect them
        const io = req.app.get('io');
        if (io) {
             io.to(`user:${userId}`).emit('user:banned', { type: 'PERMANENT' });
        }
    }

    res.json({ message: 'User banned', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove Ban
router.post('/unban', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { globalBanType: null, globalBanUntil: null }
    });

    res.json({ message: 'User unbanned', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// List all rooms for admin
router.get('/rooms', async (req: AuthRequest, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        owner: { select: { username: true } },
        _count: { select: { members: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete any room
router.delete('/rooms/:roomId', async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    
    // Cascade delete is handled by DB if configured, but let's be safe or just delete.
    // Prisma schema usually needs to be explicitly set for cascade if not using DB level.
    // We'll just delete the room; assuming Prisma handles related records if configured.
    await prisma.room.delete({
      where: { id: roomId }
    });
    
    // Clear all socket memberships for this room
    const io = req.app.get('io');
    if (io) {
      io.socketsLeave(`room:${roomId}`);
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
