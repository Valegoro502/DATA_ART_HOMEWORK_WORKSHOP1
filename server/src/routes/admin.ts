import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/authMiddleware';

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
    res.json(users);
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

export default router;
