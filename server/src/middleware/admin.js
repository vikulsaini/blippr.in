import { User } from '../models/index.js';

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden: Admins only' });
    }
    next();
  } catch (error) {
    next(error);
  }
};
