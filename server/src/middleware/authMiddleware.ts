import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    isGlobalAdmin: boolean;
    globalBanType: string | null;
    globalBanUntil: Date | null;
  };
  sessionId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // First, verify the session token in DB exists and is valid
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalidated' });
    }

    if (session.user.globalBanType === 'PERMANENT') {
      return res.status(403).json({ error: 'Your account has been permanently banned.' });
    }

    if (session.user.globalBanType === 'PARTIAL' && session.user.globalBanUntil) {
      if (new Date() > session.user.globalBanUntil) {
        // Ban expired!
        await prisma.user.update({
          where: { id: session.user.id },
          data: { globalBanType: null, globalBanUntil: null }
        });
        session.user.globalBanType = null;
        session.user.globalBanUntil = null;
      }
    }

    // Optional: verify JWT signature, but if the session is in DB, we trust it
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token signature' });
    }

    // Attach user to request
    req.user = { 
      id: session.user.id, 
      username: session.user.username,
      isGlobalAdmin: session.user.isGlobalAdmin,
      globalBanType: session.user.globalBanType,
      globalBanUntil: session.user.globalBanUntil
    };
    req.sessionId = session.id;

    // Update lastActive
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() }
    });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isGlobalAdmin) {
    return res.status(403).json({ error: 'Requires global administrator privileges' });
  }
  next();
};
