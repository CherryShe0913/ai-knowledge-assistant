import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const profileRouter = Router();
profileRouter.use(authenticate);

// PUT /api/profile — update name / avatar
profileRouter.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, avatar } = req.body;
    if (!name || !name.trim()) {
      throw createError('Name is required', 400);
    }
    if (name.trim().length > 50) {
      throw createError('Name must be 50 characters or less', 400);
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name: name.trim(),
        ...(avatar !== undefined && { avatar: avatar || null }),
      },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });

    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile/password — change password
profileRouter.put('/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw createError('Current password and new password are required', 400);
    }
    if (newPassword.length < 6) {
      throw createError('New password must be at least 6 characters', 400);
    }
    if (currentPassword === newPassword) {
      throw createError('New password must be different from current password', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw createError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw createError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});
