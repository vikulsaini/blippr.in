import Joi from 'joi';
import FriendRequest from '../models/FriendRequest.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notification.service.js';

export const friendRequestSchema = Joi.object({
  userId: Joi.string().hex().length(24).required()
});

export const sendFriendRequest = asyncHandler(async (req, res) => {
  if ((req.user.blockedUsers || []).some((userId) => userId.toString() === req.body.userId)) {
    const error = new Error('User is blocked');
    error.status = 403;
    throw error;
  }
  const target = await User.findById(req.body.userId).select('blockedUsers');
  if (!target || target.blockedUsers.some((userId) => userId.toString() === req.user._id.toString())) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const request = await FriendRequest.findOneAndUpdate(
    { from: req.user._id, to: req.body.userId },
    { status: 'pending' },
    { upsert: true, new: true }
  );
  await request.populate('from', 'name username avatar');
  req.app.get('io')?.to(`user:${req.body.userId}`).emit('friend:request:new', { request });
  const { notification } = await notifyUser(req.body.userId, {
    title: 'New friend request',
    body: `${req.user.name} wants to connect on Varta`,
    url: '/app/profile',
    type: 'friend-request',
    requestId: request._id,
    actor: req.user._id
  });
  req.app.get('io')?.to(`user:${req.body.userId}`).emit('notification:new', { notification });
  res.status(201).json({ request });
});

export const respondFriendRequest = asyncHandler(async (req, res) => {
  const request = await FriendRequest.findOne({ _id: req.params.id, to: req.user._id });
  if (!request) {
    const error = new Error('Friend request not found');
    error.status = 404;
    throw error;
  }
  request.status = req.body.status;
  await request.save();
  let chat = null;
  if (request.status === 'accepted') {
    const members = [request.from.toString(), request.to.toString()].sort();
    chat = await Chat.findOne({ type: 'direct', members: { $all: members } });
    if (!chat) {
      chat = await Chat.create({ type: 'direct', members, temporary: false });
    } else if (chat.temporary) {
      chat.temporary = false;
      await chat.save();
    }
  }
  if (request.status === 'accepted' && chat) {
    const populatedChat = await Chat.findById(chat._id)
      .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
      .populate('lastMessage');
    const io = req.app.get('io');
    const acceptedBy = {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      avatar: req.user.avatar
    };
    io?.to(`user:${request.from}`).emit('friend:request:accepted', {
      request,
      chat: populatedChat,
      notification: {
        title: 'Friend request accepted',
        body: `${req.user.name} accepted your friend request`,
        acceptedBy
      }
    });
    io?.to(`user:${request.to}`).emit('friend:request:accepted', { request, chat: populatedChat });
    io?.to(`user:${request.from}`).emit('chat:updated', { chat: populatedChat, unreadCount: 0 });
    io?.to(`user:${request.to}`).emit('chat:updated', { chat: populatedChat, unreadCount: 0 });
    const { notification } = await notifyUser(request.from, {
      title: 'Friend request accepted',
      body: `${req.user.name} accepted your friend request`,
      url: `/app?chat=${chat._id}`,
      type: 'friend-request-accepted',
      requestId: request._id,
      chatId: chat._id,
      actor: req.user._id
    });
    io?.to(`user:${request.from}`).emit('notification:new', { notification });
  }
  res.json({ request, chat });
});

export const listFriendRequests = asyncHandler(async (req, res) => {
  const requests = await FriendRequest.find({ to: req.user._id, status: 'pending' }).populate('from', 'name username avatar bio age gender');
  res.json({ requests });
});

export const listSentFriendRequests = asyncHandler(async (req, res) => {
  const requests = await FriendRequest.find({ from: req.user._id, status: 'pending' }).populate('to', 'name username avatar bio age gender');
  res.json({ requests });
});

export const cancelSentFriendRequest = asyncHandler(async (req, res) => {
  const request = await FriendRequest.findOneAndDelete({
    from: req.user._id,
    to: req.params.userId,
    status: 'pending'
  });

  if (request) {
    req.app.get('io')?.to(`user:${req.params.userId}`).emit('friend:request:cancelled', { requestId: request._id, from: req.user._id });
  }

  res.json({ ok: true });
});
