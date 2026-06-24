import { Router, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const chatRouter = Router();
chatRouter.use(authenticate);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `你是一个专业的 AI 知识助手，擅长回答各类问题、解释概念、提供分析和建议。
请用简洁清晰的中文回答问题，适当使用 Markdown 格式来提升可读性。
对于技术问题，请提供具体的代码示例。对于复杂问题，请分步骤解释。`;

// POST /api/chat/:sessionId/message — send a message (streaming)
chatRouter.post('/:sessionId/message', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw createError('Message content is required', 400);
    }

    // Verify session ownership
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });
    if (!session) throw createError('Session not found', 404);

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: { sessionId, role: 'user', content: content.trim() },
    });

    // Build message history for Claude
    const messageHistory = session.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
    messageHistory.push({ role: 'user', content: content.trim() });

    // Stream response from Claude
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullResponse = '';

    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messageHistory,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        const text = chunk.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    // Save assistant message to DB
    const assistantMessage = await prisma.chatMessage.create({
      data: { sessionId, role: 'assistant', content: fullResponse },
    });

    // Update session title if it's the first message
    if (session.messages.length === 0 && session.title === '新对话') {
      const title = content.trim().slice(0, 30) + (content.length > 30 ? '...' : '');
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    res.write(`data: ${JSON.stringify({ type: 'done', messageId: assistantMessage.id, userMessageId: userMessage.id })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
});
