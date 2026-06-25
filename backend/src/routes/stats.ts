import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const statsRouter = Router();
statsRouter.use(authenticate);

// GET /api/stats/summary — usage summary for current user
statsRouter.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [sessionCount, messageCount, documentCount, recentSessions] = await Promise.all([
      prisma.chatSession.count({ where: { userId: req.userId } }),
      prisma.chatMessage.count({
        where: { session: { userId: req.userId } },
      }),
      prisma.document.count({ where: { userId: req.userId } }),
      prisma.chatSession.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
    ]);

    // Message trend: count per day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        session: { userId: req.userId },
        createdAt: { gte: sevenDaysAgo },
        role: 'user',
      },
      select: { createdAt: true },
    });

    // Group by date string
    const trendMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const msg of recentMessages) {
      const key = msg.createdAt.toISOString().slice(0, 10);
      if (key in trendMap) trendMap[key]++;
    }
    const messageTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    res.json({
      success: true,
      data: {
        summary: { sessionCount, messageCount, documentCount },
        recentSessions,
        messageTrend,
      },
    });
  } catch (err) {
    next(err);
  }
});
