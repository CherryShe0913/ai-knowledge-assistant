import { Router, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const analyzeRouter = Router();
analyzeRouter.use(authenticate);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// POST /api/analyze/:docId/summary — AI-generated summary + key points + tags
analyzeRouter.post('/:docId/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.docId, userId: req.userId },
    });
    if (!doc) throw createError('Document not found', 404);

    if (doc.content.length < 10) {
      throw createError('Document content is too short to analyze', 400);
    }

    // Truncate to ~8000 chars to stay within token limits
    const contentPreview = doc.content.slice(0, 8000);
    const wasTruncated = doc.content.length > 8000;

    const prompt = `请对以下文档进行分析，用中文输出，严格按 JSON 格式返回，不要有多余内容：

文档标题：${doc.title}
文档内容：
${contentPreview}
${wasTruncated ? '\n[内容已截断，仅展示前 8000 字]' : ''}

请返回如下 JSON 格式：
{
  "summary": "200字以内的核心摘要",
  "keyPoints": ["要点1", "要点2", "要点3（最多5条）"],
  "tags": ["标签1", "标签2", "标签3（最多5个）"],
  "wordCount": 文档字符数（整数）,
  "readingMinutes": 预计阅读分钟数（整数）
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    // Extract JSON robustly
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw createError('AI response could not be parsed', 500);

    const analysis = JSON.parse(jsonMatch[0]) as {
      summary: string;
      keyPoints: string[];
      tags: string[];
      wordCount: number;
      readingMinutes: number;
    };

    res.json({ success: true, data: { analysis, truncated: wasTruncated } });
  } catch (err) {
    next(err);
  }
});

// POST /api/analyze/:docId/ask — ask a question about the document
analyzeRouter.post('/:docId/ask', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      throw createError('Question is required', 400);
    }
    if (question.trim().length > 500) {
      throw createError('Question is too long (max 500 chars)', 400);
    }

    const doc = await prisma.document.findFirst({
      where: { id: req.params.docId, userId: req.userId },
    });
    if (!doc) throw createError('Document not found', 404);

    const contentPreview = doc.content.slice(0, 8000);
    const wasTruncated = doc.content.length > 8000;

    // Stream the answer
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const systemPrompt = `你是一个文档分析助手。用户提供了一篇文档，你需要基于文档内容回答用户的问题。
回答要准确、简洁，用中文。如果文档中没有相关信息，请明确说明"文档中未提及此内容"。`;

    const userContent = `文档标题：${doc.title}
${wasTruncated ? '（注意：文档已截断，仅包含前 8000 字）' : ''}

文档内容：
${contentPreview}

---

用户问题：${question.trim()}`;

    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
});
