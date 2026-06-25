import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const searchRouter = Router();
searchRouter.use(authenticate);

// GET /api/search?q=keyword&type=sessions|messages|all
// Search sessions by title or message content
searchRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string || '').trim();
    const type = (req.query.type as string) || 'all';

    if (!q) throw createError('Search query is required', 400);
    if (q.length < 1) throw createError('Search query too short', 400);
    if (q.length > 200) throw createError('Search query too long', 400);

    const results: {
      sessions: SessionResult[];
      messages: MessageResult[];
    } = { sessions: [], messages: [] };

    // Search sessions by title
    if (type === 'sessions' || type === 'all') {
      const sessions = await prisma.chatSession.findMany({
        where: {
          userId: req.userId,
          title: { contains: q },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      });
      results.sessions = sessions.map((s) => ({
        ...s,
        matchType: 'title' as const,
      }));
    }

    // Search messages by content
    if (type === 'messages' || type === 'all') {
      const messages = await prisma.chatMessage.findMany({
        where: {
          session: { userId: req.userId },
          content: { contains: q },
          role: 'user',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
          session: {
            select: { id: true, title: true },
          },
        },
      });

      // Deduplicate by session — keep the most recent match per session
      const seen = new Set<string>();
      results.messages = messages
        .filter((m) => {
          if (seen.has(m.session.id)) return false;
          seen.add(m.session.id);
          return true;
        })
        .map((m) => ({
          id: m.id,
          sessionId: m.session.id,
          sessionTitle: m.session.title,
          snippet: buildSnippet(m.content, q),
          role: m.role,
          createdAt: m.createdAt.toISOString(),
        }));
    }

    res.json({
      success: true,
      data: {
        query: q,
        totalSessions: results.sessions.length,
        totalMessages: results.messages.length,
        ...results,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/search/export/:sessionId — export session as markdown
searchRouter.get('/export/:sessionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.sessionId, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) throw createError('Session not found', 404);

    const lines: string[] = [
      `# ${session.title}`,
      ``,
      `> 导出时间：${new Date().toLocaleString('zh-CN')}  `,
      `> 消息数量：${session.messages.length}`,
      ``,
      `---`,
      ``,
    ];

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '**👤 用户**' : '**🤖 AI 助手**';
      const time = new Date(msg.createdAt).toLocaleString('zh-CN');
      lines.push(`### ${role}`);
      lines.push(`> ${time}`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }

    const markdown = lines.join('\n');
    const filename = `chat-${session.title.replace(/[^a-zA-Z0-9一-龥]/g, '-').slice(0, 30)}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(markdown);
  } catch (err) {
    next(err);
  }
});

// --- Helpers ---

interface SessionResult {
  id: string;
  title: string;
  updatedAt: Date;
  _count: { messages: number };
  matchType: 'title';
}

interface MessageResult {
  id: string;
  sessionId: string;
  sessionTitle: string;
  snippet: string;
  role: string;
  createdAt: string;
}

function buildSnippet(content: string, query: string, maxLen = 120): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');

  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 40);
  const snippet = content.slice(start, end);
  return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
}
