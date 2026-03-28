import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Search users
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { search } = req.query;
    if (!search) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        username: { contains: search as string, mode: 'insensitive' },
        id: { not: req.user!.id }
      },
      select: { id: true, username: true, email: true }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Friends
router.get('/friends', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      include: {
        user1: { select: { id: true, username: true } },
        user2: { select: { id: true, username: true } }
      }
    });

    // Extract the other user
    const friends = friendships.map(f => {
      const isUser1 = f.user1Id === userId;
      return isUser1 ? f.user2 : f.user1;
    });

    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send Friend Request
router.post('/:recipientId/friend-request', authenticate, async (req: AuthRequest, res) => {
  try {
    const { recipientId } = req.params;
    const userId = req.user!.id;

    if (recipientId === userId) return res.status(400).json({ error: 'Cannot add yourself' });

    // Check ban
    const ban = await prisma.userBan.findFirst({
      where: {
        OR: [
          { bannerId: userId, bannedId: recipientId },
          { bannerId: recipientId, bannedId: userId }
        ]
      }
    });
    if (ban) return res.status(403).json({ error: 'User interaction banned' });

    const existingId = userId < recipientId ? userId : recipientId;
    const existingId2 = userId < recipientId ? recipientId : userId;

    await prisma.friendship.upsert({
      where: { user1Id_user2Id: { user1Id: existingId, user2Id: existingId2 } },
      create: {
        user1Id: existingId,
        user2Id: existingId2,
        status: 'PENDING'
        // In real app, track who initiated, here simply creating pending bidirectional
        // For simplicity we let receiver accept it or sender can cancel
      },
      update: {}
    });

    res.json({ message: 'Request sent' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept Friend Request
router.post('/:senderId/accept', authenticate, async (req: AuthRequest, res) => {
  try {
    const { senderId } = req.params;
    const userId = req.user!.id;
    
    const existingId = userId < senderId ? userId : senderId;
    const existingId2 = userId < senderId ? senderId : userId;

    await prisma.friendship.update({
      where: { user1Id_user2Id: { user1Id: existingId, user2Id: existingId2 } },
      data: { status: 'ACCEPTED' }
    });

    res.json({ message: 'Request accepted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
