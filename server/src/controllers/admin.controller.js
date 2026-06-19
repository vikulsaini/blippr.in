import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Temporary endpoint to claim the first admin account
// In production, you would remove this after claiming
export const claimAdmin = asyncHandler(async (req, res) => {
  const { secret } = req.body;
  if (secret !== 'BlipprAdminSecret2026') {
    return res.status(403).json({ ok: false, message: 'Invalid secret' });
  }

  const user = req.user;
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  user.role = 'admin';
  user.isVerified = true;
  await user.save();

  res.json({ ok: true, message: 'You are now an admin!' });
});

export const getStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isOnline: true });
  const totalChats = await Chat.countDocuments();
  const totalMessages = await Message.countDocuments();

  res.json({
    ok: true,
    stats: {
      totalUsers,
      activeUsers,
      totalChats,
      totalMessages
    }
  });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    const escapedQ = String(q || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: '^' + escapedQ, $options: 'i' } },
      { username: { $regex: '^' + escapedQ, $options: 'i' } },
      { email: { $regex: '^' + escapedQ, $options: 'i' } }
    ];
  }

  const users = await User.find(filter)
    .select('name username email role isVerified isOnline lastSeenAt createdAt safetyViolationCount bannedUntil avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ ok: true, users });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, value } = req.body; // action: 'ban', 'verify', 'role'

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  if (action === 'ban') {
    if (value) {
      // Ban for 100 years
      user.bannedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    } else {
      user.bannedUntil = null;
    }
  } else if (action === 'verify') {
    user.isVerified = !!value;
  } else if (action === 'role') {
    user.role = value;
  }

  await user.save();
  res.json({ ok: true, user });
});

export const broadcastMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ ok: false, message: 'Message is required' });

  const io = req.app.get('io');
  if (io) {
    io.fetchSockets().then((sockets) => {
      const batchSize = 100;
      let index = 0;
      function sendBatch() {
        const batch = sockets.slice(index, index + batchSize);
        if (batch.length === 0) return;
        for (const s of batch) {
          s.emit('system:broadcast', { message, timestamp: new Date() });
        }
        index += batchSize;
        if (index < sockets.length) {
          setTimeout(sendBatch, 50);
        }
      }
      sendBatch();
    }).catch((err) => {
      console.error('Failed to fetch sockets for broadcast:', err);
    });
  }

  res.json({ ok: true, message: 'Broadcast sent' });
});
