import Joi from 'joi';
import FriendRequest from '../models/FriendRequest.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notification.service.js';

export const friendRequestSchema = Joi.object({
  userId: Joi.string().pattern(/^[0-9a-fA-F-]{24,36}$/).required(),
  sourceChatId: Joi.string().pattern(/^[0-9a-fA-F-]{24,36}$/).optional()
});

const RANDOM_FRIEND_REQUEST_MIN_MS = 3 * 60 * 1000;

export const sendFriendRequest = asyncHandler(async (req, res) => {
  if (req.user.isGuest) {
    const error = new Error('Guest users cannot send friend requests.');
    error.status = 403;
    throw error;
  }
  
  const targetId = req.body.userId;
  const currentUserId = req.user._id.toString();

  // Prevent sending friend requests to oneself
  if (currentUserId === targetId) {
    const error = new Error('Cannot send friend request to yourself.');
    error.status = 400;
    throw error;
  }

  const target = await User.findById(targetId).select('blockedUsers isGuest');
  if (!target || target.blockedUsers.some((userId) => userId.toString() === currentUserId)) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  if (target.isGuest) {
    const error = new Error('Cannot send friend request to guest users.');
    error.status = 403;
    throw error;
  }
  if (req.body.sourceChatId) {
    const sourceChat = await Chat.findOne({
      _id: req.body.sourceChatId,
      type: 'stranger',
      temporary: true,
      members: { $all: [req.user._id, targetId] }
    }).select('createdAt');
    if (!sourceChat) {
      const error = new Error('Random chat session not found');
      error.status = 404;
      throw error;
    }
    const elapsed = Date.now() - sourceChat.createdAt.getTime();
    if (elapsed < RANDOM_FRIEND_REQUEST_MIN_MS) {
      const remainingSeconds = Math.ceil((RANDOM_FRIEND_REQUEST_MIN_MS - elapsed) / 1000);
      const error = new Error(`Talk for ${Math.ceil(remainingSeconds / 60)} more minute${remainingSeconds > 60 ? 's' : ''} before sending a friend request`);
      error.status = 429;
      throw error;
    }
  }

  // Check if a relationship/friend request already exists in either direction
  const existing = await FriendRequest.findOne({
    $or: [
      { from: req.user._id, to: targetId },
      { from: targetId, to: req.user._id }
    ]
  });

  let request;
  if (existing) {
    if (existing.status === 'accepted') {
      const error = new Error('You are already friends with this user.');
      error.status = 400;
      throw error;
    }
    if (existing.status === 'pending') {
      if (existing.from.toString() === currentUserId) {
        const error = new Error('Friend request already sent.');
        error.status = 400;
        throw error;
      } else {
        const error = new Error('You already have a pending friend request from this user.');
        error.status = 400;
        throw error;
      }
    }
    // If it was rejected, we reset it to pending and align 'from' and 'to' to the new request direction
    existing.from = req.user._id;
    existing.to = targetId;
    existing.status = 'pending';
    await existing.save();
    request = existing;
  } else {
    request = await FriendRequest.create({
      from: req.user._id,
      to: targetId,
      status: 'pending'
    });
  }

  await request.populate('from', 'name username avatar');
  req.app.get('io')?.to(`user:${targetId}`).emit('friend:request:new', { request });
  const { notification } = await notifyUser(targetId, {
    title: 'New friend request',
    body: `${req.user.name} wants to connect on Blippr`,
    url: '/app/profile',
    type: 'friend-request',
    requestId: request._id,
    actor: req.user._id
  });
  req.app.get('io')?.to(`user:${targetId}`).emit('notification:new', { notification });
  res.status(201).json({ request });
});

export const respondFriendRequest = asyncHandler(async (req, res) => {
  if (req.user.isGuest) {
    const error = new Error('Guest users cannot accept friend requests.');
    error.status = 403;
    throw error;
  }
  const request = await FriendRequest.findOne({ _id: req.params.id, to: req.user._id });
  if (!request) {
    const error = new Error('Friend request not found');
    error.status = 404;
    throw error;
  }
  if (request.status !== 'pending') {
    const error = new Error('Friend request has already been responded to.');
    error.status = 400;
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
      .populate('members', 'name username avatar bio age gender isOnline lastSeenAt')
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

export const unfriend = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const myId = req.user._id.toString();

  // Find direct chat between these two users
  const chat = await Chat.findOne({
    type: 'direct',
    members: { $all: [myId, userId] }
  });

  // Delete friend requests
  await FriendRequest.deleteMany({
    $or: [
      { from: myId, to: userId },
      { from: userId, to: myId }
    ]
  });

  if (chat) {
    chat.temporary = true;
    await chat.save();
    const io = req.app.get('io');
    chat.members.forEach((memberId) => {
      io?.to(`user:${memberId.toString()}`).emit('chat:removed', { chatId: chat._id });
    });
  }

  res.json({ ok: true });
});

