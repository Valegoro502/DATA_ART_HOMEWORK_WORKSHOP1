import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

const sendMessageSchema = z.object({
  roomId: z.string().optional(),
  recipientId: z.string().optional(),
  content: z.string().max(3000), // Max text size 3KB
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  replyToId: z.string().optional()
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId, recipientId, content, attachmentUrl, attachmentName, replyToId } = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;

    if (!roomId && !recipientId) {
      return res.status(400).json({ error: 'Must provide roomId or recipientId' });
    }

    if (roomId) {
      // Room Message validation
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: senderId } }
      });
      if (!member) return res.status(403).json({ error: 'Not a room member' });
      
      const isBanned = await prisma.roomBan.findUnique({
        where: { roomId_userId: { roomId, userId: senderId } }
      });
      if (isBanned) return res.status(403).json({ error: 'Banned from room' });

    } else if (recipientId) {
      // Personal Message validation
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { user1Id: senderId, user2Id: recipientId },
            { user1Id: recipientId, user2Id: senderId }
          ]
        }
      });
      if (!friendship) return res.status(403).json({ error: 'You are not friends' });

      const ban = await prisma.userBan.findFirst({
        where: {
          OR: [
            { bannerId: senderId, bannedId: recipientId },
            { bannerId: recipientId, bannedId: senderId }
          ]
        }
      });
      if (ban) return res.status(403).json({ error: 'Message blocked by ban' });
    }

    const message = await prisma.message.create({
      data: {
        roomId: roomId || null,
        recipientId: recipientId || null,
        senderId,
        content,
        attachmentUrl,
        attachmentName,
        replyToId
      },
      include: {
        sender: { select: { id: true, username: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { username: true } } } }
      }
    });

    // We can't emit websocket events from here easily without sharing the io instance,
    // so let's just return the message and let the frontend emit a WS 'chat:sent' event 
    // to broadcast, OR we can attach io to req.app.get('io').
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit message
router.patch('/:messageId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const { content } = z.object({ content: z.string().max(3000) }).parse(req.body);
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: 'Not found' });
    if (message.senderId !== userId) return res.status(403).json({ error: 'Unauthorized to edit' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
       include: {
        sender: { select: { id: true, username: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { username: true } } } }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/:messageId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({ 
        where: { id: messageId },
        include: { room: true }
    });
    if (!message) return res.status(404).json({ error: 'Not found' });

    let allowed = false;
    if (message.senderId === userId) {
        allowed = true;
    } else if (message.roomId) {
        // Check if admin
        const member = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId: message.roomId, userId } }
        });
        if (member && member.role === 'ADMIN') allowed = true;
        if (message.room && message.room.ownerId === userId) allowed = true;
    }

    if (!allowed) return res.status(403).json({ error: 'Unauthorized to delete' });

    await prisma.message.delete({ where: { id: messageId } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
