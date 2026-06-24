import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const sessionsRouter = Router();

// All routes require authentication
sessionsRouter.use(authenticate);

// GET /api/sessions — list all sessions for current user
sessionsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    res.json({ success: true, data: { sessions } });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions — create a new session
sessionsRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title } = req.body;
    const session = await prisma.chatSession.create({
      data: {
        title: title || '新对话',
        userId: req.userId!,
      },
    });
    res.status(201).json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id — get session with messages
sessionsRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) {
      throw createError('Session not found', 404);
    }

    res.json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:id — rename session
sessionsRouter.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title } = req.body;
    if (!title) throw createError('Title is required', 400);

    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) throw createError('Session not found', 404);

    const updated = await prisma.chatSession.update({
      where: { id: req.params.id },
      data: { title },
    });

    res.json({ success: true, data: { session: updated } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id — delete session
sessionsRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) throw createError('Session not found', 404);

    await prisma.chatSession.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    next(err);
  }
});
