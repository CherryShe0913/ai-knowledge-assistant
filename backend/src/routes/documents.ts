import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const documentsRouter = Router();
documentsRouter.use(authenticate);

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['text/plain', 'text/markdown', 'application/json'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .md, and .json files are supported'));
    }
  },
});

// GET /api/documents — list user's documents
documentsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ success: true, data: { documents } });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents — upload a document
documentsRouter.post('/', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file && !req.body.content) {
      throw createError('File or content is required', 400);
    }

    const title = req.body.title || req.file?.originalname || 'Untitled Document';
    const content = req.file ? req.file.buffer.toString('utf-8') : req.body.content;
    const fileType = req.file?.mimetype.split('/')[1] || 'text';
    const fileSize = req.file?.size || Buffer.byteLength(content, 'utf-8');

    const document = await prisma.document.create({
      data: {
        title,
        content,
        fileType,
        fileSize,
        userId: req.userId!,
      },
    });

    res.status(201).json({ success: true, data: { document } });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id — get document content
documentsRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!document) throw createError('Document not found', 404);
    res.json({ success: true, data: { document } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id — delete document
documentsRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!document) throw createError('Document not found', 404);

    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
});
