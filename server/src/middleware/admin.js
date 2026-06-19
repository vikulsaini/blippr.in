export const requireAdmin = async (req, res, next) => {
  try {
    const user = req.user;
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
