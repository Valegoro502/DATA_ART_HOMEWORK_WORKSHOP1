import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// 2.4.3. Public Rooms Catalog
router.get('/public', authenticate, async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string;
    
    const rooms = await prisma.room.findMany({
      where: {
        isPrivate: false,
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { members: true } }
      }
    });
    
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Room
const createRoomSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(200).optional(),
  isPrivate: z.boolean().default(false)
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, description, isPrivate } = createRoomSchema.parse(req.body);
    const userId = req.user!.id;

    if (req.user!.globalBanType === 'PARTIAL') {
      let msg = 'You are partially banned and cannot create rooms.';
      if (req.user!.globalBanUntil) {
          const diff = req.user!.globalBanUntil.getTime() - Date.now();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          msg = `You are partially banned. Time remaining: ${hours} hours and ${mins} minutes.`;
      }
      return res.status(403).json({ error: msg });
    }

    const existingInfo = await prisma.room.findUnique({ where: { name } });
    if (existingInfo) {
      return res.status(400).json({ error: 'Room name must be unique' });
    }

    const room = await prisma.room.create({
      data: {
        name,
        description,
        isPrivate,
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'ADMIN'
          }
        }
      }
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Room
router.delete('/:roomId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId !== userId && !req.user!.isGlobalAdmin) {
      return res.status(403).json({ error: 'Only the room owner or a global admin can delete this room' });
    }

    await prisma.room.delete({ where: { id: roomId } });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error parsing room deletion' });
  }
});

// Get user's active rooms
router.get('/my-rooms', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const rooms = await prisma.room.findMany({
      where: {
        members: { some: { userId } }
      },
      include: {
        members: { where: { userId } }
      }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room context (members, etc.)
router.get('/:roomId/context', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Verify member
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, email: true } } }
        }
      }
    });

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join Room (Public)
router.post('/:roomId/join', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.globalBanType === 'PARTIAL') {
      let msg = 'You are partially banned and cannot join new rooms.';
      if (req.user!.globalBanUntil) {
          const diff = req.user!.globalBanUntil.getTime() - Date.now();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          msg = `You are partially banned. Time remaining: ${hours} hours and ${mins} minutes.`;
      }
      return res.status(403).json({ error: msg });
    }

    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    if (room.isPrivate) {
      return res.status(403).json({ error: 'Room is private' });
    }

    const ban = await prisma.roomBan.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (ban) return res.status(403).json({ error: 'You are banned from this room' });

    await prisma.roomMember.create({
      data: {
        roomId,
        userId,
        role: 'MEMBER'
      }
    });

    res.json({ message: 'Joined successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error or already joined' });
  }
});

// Leave Room
router.post('/:roomId/leave', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.ownerId === userId) {
      return res.status(400).json({ error: 'Owner cannot leave their own room' });
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } }
    });

    res.json({ message: 'Left room' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Historical Messages
router.get('/:roomId/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userId = req.user!.id;

    // Check membership
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    let takeVal = Number(limit);
    if (takeVal > 100) takeVal = 100;

    const messages = await prisma.message.findMany({
      where: { roomId },
      take: takeVal,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor as string } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { username: true } } } }
      }
    });

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Invite User
router.post('/:roomId/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body;
    
    const inviterMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: req.user!.id } }
    });

    if (!inviterMembership && !req.user!.isGlobalAdmin) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const existingMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUser.id } }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already in the room' });
    }

    await prisma.roomMember.create({
      data: { roomId, userId: targetUser.id, role: 'MEMBER' }
    });

    res.json({ message: 'User invited successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
