import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    
    // Check existing
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      return res.status(400).json({ error: 'Username already in use' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { id: true, username: true, email: true, isGlobalAdmin: true }
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({ userId: user.id });

    // Store session
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const browserFingerprint = req.headers['user-agent'] || 'unknown browser';

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: token,
        ipAddress,
        browserFingerprint
      }
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, isGlobalAdmin: user.isGlobalAdmin }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sessions', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id },
      orderBy: { lastActive: 'desc' }
    });
    
    // Mark current session
    const formatted = sessions.map(s => ({
      id: s.id,
      ipAddress: s.ipAddress,
      browserFingerprint: s.browserFingerprint,
      lastActive: s.lastActive,
      isCurrent: s.id === req.sessionId
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/sessions/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.session.findUnique({ where: { id } });
    
    if (!session || session.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Session not found or inaccessible' });
    }

    await prisma.session.delete({ where: { id } });
    res.json({ message: 'Session terminated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
