import Call from '../models/Call.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCalls = asyncHandler(async (req, res) => {
  const calls = await Call.find({
    $or: [{ caller: req.user._id }, { receiver: req.user._id }]
  })
    .populate('caller receiver', 'name username avatar')
    .sort('-createdAt')
    .limit(50);

  res.json({ calls });
});
