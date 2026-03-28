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
    const { message } = req.body;
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
        status: 'PENDING',
        initiatorId: userId,
        message: message || null
      },
      update: {
        status: 'PENDING',
        initiatorId: userId,
        message: message || null
      }
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
      data: { status: 'ACCEPTED', message: null }
    });

    res.json({ message: 'Request accepted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Pending Requests (Received)
router.get('/pending-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const requests = await prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        OR: [{ user1Id: userId }, { user2Id: userId }],
        initiatorId: { not: userId }
      },
      include: { user1: { select: { id: true, username: true } }, user2: { select: { id: true, username: true } } }
    });
    
    const mapped = requests.map(r => {
      const user = r.user1Id === userId ? r.user2 : r.user1;
      return { ...user, message: r.message };
    });
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Blocked Users
router.get('/blocked', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const blocks = await prisma.userBan.findMany({
      where: { bannerId: userId },
      include: { banned: { select: { id: true, username: true } } }
    });
    
    // map to just return standard user-like objects
    const blockedUsers = blocks.map(b => b.banned);
    res.json(blockedUsers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove Friend or Cancel Request
router.delete('/friends/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const targetId = req.params.id;
    const existingId = userId < targetId ? userId : targetId;
    const existingId2 = userId < targetId ? targetId : userId;
    
    await prisma.friendship.deleteMany({
      where: { user1Id: existingId, user2Id: existingId2 }
    });
    res.json({ message: 'Removed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Block user 1-to-1
router.post('/:id/block', authenticate, async (req: AuthRequest, res) => {
  try {
    const bannerId = req.user!.id;
    const bannedId = req.params.id;
    if (bannerId === bannedId) return res.status(400).json({ error: 'Cannot block yourself' });
    
    await prisma.userBan.upsert({
      where: { bannerId_bannedId: { bannerId, bannedId } },
      create: { bannerId, bannedId },
      update: {}
    });

    const existingId = bannerId < bannedId ? bannerId : bannedId;
    const existingId2 = bannerId < bannedId ? bannedId : bannerId;
    await prisma.friendship.deleteMany({
      where: { user1Id: existingId, user2Id: existingId2 }
    });
    
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: 'Server error adding block' });
  }
});

// Unblock user 1-to-1
router.post('/:id/unblock', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.userBan.deleteMany({
      where: { bannerId: req.user!.id, bannedId: req.params.id }
    });
    res.json({ message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Personal Messages
router.get('/:recipientId/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { recipientId } = req.params;
    const userId = req.user!.id;
    const { cursor, limit = 50 } = req.query;

    let takeVal = Number(limit);
    if (takeVal > 100) takeVal = 100;

    const messages = await prisma.message.findMany({
      where: {
        roomId: null,
        OR: [
          { senderId: userId, recipientId: recipientId },
          { senderId: recipientId, recipientId: userId }
        ]
      },
      take: takeVal,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor as string } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { username: true } } } }
      }
    });

    const block = await prisma.userBan.findFirst({
      where: {
        OR: [
          { bannerId: userId, bannedId: recipientId },
          { bannerId: recipientId, bannedId: userId }
        ]
      }
    });

    res.json({ messages: messages.reverse(), isBlocked: !!block });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching personal messages' });
  }
});

export default router;
