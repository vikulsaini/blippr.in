import Joi from 'joi';
import Chat from '../models/Chat.js';
import Call from '../models/Call.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notification.service.js';

export const createDirectChatSchema = Joi.object({
  userId: Joi.string().hex().length(24).required()
});

export const messageSchema = Joi.object({
  text: Joi.string().max(4000).allow('').optional(),
  replyTo: Joi.string().hex().length(24).optional(),
  mentions: Joi.array().items(Joi.string().hex().length(24)).max(10).optional(),
  media: Joi.object({
    url: Joi.string().uri().required(),
    type: Joi.string().valid('image', 'video', 'audio', 'file').required(),
    publicId: Joi.string().optional(),
    name: Joi.string().trim().max(180).optional(),
    mimeType: Joi.string().trim().max(120).optional(),
    size: Joi.number().integer().min(0).optional()
  }).optional()
}).or('text', 'media');

export const reactionSchema = Joi.object({
  emoji: Joi.string().min(1).max(8).required()
});

export const editMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(4000).required()
});

export const nicknameSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  nickname: Joi.string().trim().max(40).allow('').required()
});

export const chatPreferenceSchema = Joi.object({
  enabled: Joi.boolean().required()
});

function pageLimit(value, fallback = 30, max = 80) {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

function dateCursor(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pageInfo(items, limit, field = 'createdAt') {
  return {
    nextCursor: items.length === limit ? items[items.length - 1]?.[field]?.toISOString?.() || String(items[items.length - 1]?.[field] || '') : null,
    hasMore: items.length === limit
  };
}

function withUnreadCount(chat, userId) {
  const item = chat.toObject ? chat.toObject({ flattenMaps: true }) : chat;
  item.unreadCount = chat.unreadCounts?.get(userId.toString()) || 0;
  item.pinned = (chat.pinnedFor || []).some((id) => id.toString() === userId.toString());
  item.starred = (chat.starredFor || []).some((id) => id.toString() === userId.toString());
  item.muted = (chat.mutedFor || []).some((id) => id.toString() === userId.toString());
  item.archived = (chat.archivedFor || []).some((id) => id.toString() === userId.toString());
  return item;
}

async function populateMessage(messageId) {
  return Message.findById(messageId)
    .populate('sender', 'name username avatar')
    .populate('replyTo', 'text sender');
}

function receiverIds(chat, senderId) {
  return chat.members.filter((memberId) => memberId.toString() !== senderId.toString());
}

function applyBlockedWords(text = '', blockedWords = []) {
  return blockedWords.reduce((value, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? value.replace(new RegExp(escaped, 'gi'), '***') : value;
  }, text);
}

function deliveryReceiptsFor(chat, senderId, io) {
  return receiverIds(chat, senderId).map((memberId) => {
    const connected = (io?.sockets?.adapter?.rooms?.get(`user:${memberId}`)?.size || 0) > 0;
    return {
      user: memberId,
      status: connected ? 'delivered' : 'sent',
      deliveredAt: connected ? new Date() : undefined
    };
  });
}

function receiverIsConnected(io, chat, senderId) {
  return receiverIds(chat, senderId).some((memberId) => (io?.sockets?.adapter?.rooms?.get(`user:${memberId}`)?.size || 0) > 0);
}

async function updateChatPreference(req, res, field) {
  const chat = await Chat.findOne({ _id: req.params.chatId, type: 'direct', members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }
  if (req.body.enabled) chat[field].addToSet(req.user._id);
  else chat[field].pull(req.user._id);
  await chat.save();
  const populatedChat = await Chat.findById(chat._id)
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall');
  const decorated = withUnreadCount(populatedChat, req.user._id);
  req.app.get('io')?.to(`user:${req.user._id}`).emit('chat:updated', {
    chat: decorated,
    unreadCount: decorated.unreadCount || 0
  });
  res.json({ chat: decorated });
}

export const listChats = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 30, 60);
  const cursor = dateCursor(req.query.cursor);
  const includeArchived = req.query.archived === 'true';
  const usersBlockingMe = await User.find({ blockedUsers: req.user._id }).select('_id');
  const hiddenMemberIds = [
    ...(req.user.blockedUsers || []),
    ...usersBlockingMe.map((user) => user._id)
  ];
  const filter = {
    $and: [
      { type: 'direct' },
      { temporary: { $ne: true } },
      { members: req.user._id },
      { members: { $nin: hiddenMemberIds } },
      { hiddenFor: { $ne: req.user._id } },
      includeArchived ? { archivedFor: req.user._id } : { archivedFor: { $ne: req.user._id } },
      ...(cursor ? [{ updatedAt: { $lt: cursor } }] : [])
    ]
  };
  const chats = await Chat.find(filter)
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall')
    .sort('-updatedAt')
    .limit(limit);
  const decorated = chats
    .map((chat) => withUnreadCount(chat, req.user._id))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({
    chats: decorated,
    pageInfo: pageInfo(decorated, limit, 'updatedAt')
  });
});

export const createDirectChat = asyncHandler(async (req, res) => {
  if (req.body.userId === req.user._id.toString()) {
    const error = new Error('Cannot create a chat with yourself');
    error.status = 400;
    throw error;
  }
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
  const acceptedRequest = await FriendRequest.exists({
    status: 'accepted',
    $or: [
      { from: req.user._id, to: req.body.userId },
      { from: req.body.userId, to: req.user._id }
    ]
  });
  if (!acceptedRequest) {
    const error = new Error('Accept a friend request before starting a direct chat');
    error.status = 403;
    throw error;
  }

  const members = [req.user._id.toString(), req.body.userId].sort();
  let chat = await Chat.findOne({ type: 'direct', members: { $all: members } });
  if (!chat) chat = await Chat.create({ type: 'direct', members });
  res.status(201).json({ chat });
});

export const listMessages = asyncHandler(async (req, res) => {
  const limit = pageLimit(req.query.limit, 80, 100);
  const cursor = dateCursor(req.query.cursor);
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }
  const io = req.app.get('io');
  await Message.updateMany(
    { chat: chat._id, sender: { $ne: req.user._id }, status: 'sent', deletedAt: { $exists: false } },
    {
      $set: {
        status: 'delivered',
        'deliveryReceipts.$[receipt].status': 'delivered',
        'deliveryReceipts.$[receipt].deliveredAt': new Date()
      }
    },
    { arrayFilters: [{ 'receipt.user': req.user._id, 'receipt.status': 'sent' }] }
  );
  io?.to(`chat:${chat._id}`).emit('message:delivered', { chatId: chat._id, userId: req.user._id });

  const messages = await Message.find({
    chat: chat._id,
    deletedFor: { $ne: req.user._id },
    deletedAt: { $exists: false },
    ...(cursor ? { createdAt: { $lt: cursor } } : {})
  })
    .populate('sender', 'name username avatar')
    .populate('replyTo', 'text sender')
    .sort('-createdAt')
    .limit(limit);
  res.json({ messages: messages.reverse(), pageInfo: pageInfo(messages, limit, 'createdAt') });
});

export const listCalls = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  const calls = await Call.find({ chat: chat._id })
    .populate('caller', 'name username avatar')
    .populate('receiver', 'name username avatar')
    .sort('-createdAt')
    .limit(80);
  res.json({ calls: calls.reverse() });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }
  const io = req.app.get('io');
  const safeText = applyBlockedWords(req.body.text || '', req.user.safety?.blockedWords || []);
  const createdMessage = await Message.create({
    chat: chat._id,
    sender: req.user._id,
    status: receiverIsConnected(io, chat, req.user._id) ? 'delivered' : 'sent',
    deliveryReceipts: deliveryReceiptsFor(chat, req.user._id, io),
    ...req.body,
    text: safeText
  });
  const message = await populateMessage(createdMessage._id);
  chat.lastMessage = createdMessage._id;
  chat.hiddenFor = [];
  if (!chat.unreadCounts) chat.unreadCounts = new Map();
  for (const memberId of chat.members) {
    const key = memberId.toString();
    const current = chat.unreadCounts?.get(key) || 0;
    chat.unreadCounts.set(key, key === req.user._id.toString() ? 0 : current + 1);
  }
  await chat.save();
  const populatedChat = await Chat.findById(chat._id)
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall');
  for (const memberId of chat.members) {
    io?.to(`user:${memberId}`).emit('chat:updated', {
      chat: populatedChat,
      unreadCount: chat.unreadCounts?.get(memberId.toString()) || 0
    });
  }
  io?.to(`chat:${chat._id}`).emit('message:new', { message });
  await Promise.all(
    chat.members
      .filter((memberId) => memberId.toString() !== req.user._id.toString())
      .filter((memberId) => !(chat.mutedFor || []).some((mutedId) => mutedId.toString() === memberId.toString()))
      .map((memberId) =>
        notifyUser(memberId, {
          title: req.user.name,
          body: message.text || 'Sent a media message',
          url: `/app?chat=${chat._id}`,
          type: 'message',
          chatId: chat._id,
          messageId: message._id
        })
      )
  );
  res.status(201).json({ message });
});

export const reactToMessage = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  const message = await Message.findOne({ _id: req.params.messageId, chat: chat._id });
  if (!message) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }

  const existing = message.reactions.find((reaction) => reaction.user.toString() === req.user._id.toString());
  if (existing?.emoji === req.body.emoji) {
    message.reactions = message.reactions.filter((reaction) => reaction.user.toString() !== req.user._id.toString());
  } else if (existing) {
    existing.emoji = req.body.emoji;
  } else {
    message.reactions.push({ emoji: req.body.emoji, user: req.user._id });
  }

  await message.save();
  req.app.get('io')?.to(`chat:${chat._id}`).emit('message:reaction', {
    messageId: message._id,
    reactions: message.reactions
  });
  res.json({ message });
});

export const markChatRead = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  if (!chat.unreadCounts) chat.unreadCounts = new Map();
  chat.unreadCounts.set(req.user._id.toString(), 0);
  await chat.save();
  if (req.user.privacy?.readReceipts !== false) {
    await Message.updateMany(
      { chat: chat._id, sender: { $ne: req.user._id }, deletedAt: { $exists: false } },
      {
        $set: {
          status: 'seen',
          'deliveryReceipts.$[receipt].status': 'seen',
          'deliveryReceipts.$[receipt].seenAt': new Date()
        },
        $addToSet: { seenBy: req.user._id }
      },
      { arrayFilters: [{ 'receipt.user': req.user._id }] }
    );
    req.app.get('io')?.to(`chat:${chat._id}`).emit('message:seen', { chatId: chat._id, userId: req.user._id });
  }
  res.json({ ok: true });
});

export const updateNickname = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, type: 'direct', members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  const targetIsMember = chat.members.some((memberId) => memberId.toString() === req.body.userId);
  if (!targetIsMember || req.body.userId === req.user._id.toString()) {
    const error = new Error('Friend not found in this chat');
    error.status = 400;
    throw error;
  }

  if (!chat.nicknames) chat.nicknames = new Map();
  const key = `${req.user._id}:${req.body.userId}`;
  const nickname = req.body.nickname.trim();
  if (nickname) chat.nicknames.set(key, nickname);
  else chat.nicknames.delete(key);
  await chat.save();

  const populatedChat = await Chat.findById(chat._id)
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall');
  req.app.get('io')?.to(`user:${req.user._id}`).emit('chat:updated', {
    chat: populatedChat,
    unreadCount: populatedChat.unreadCounts?.get(req.user._id.toString()) || 0
  });
  res.json({ chat: withUnreadCount(populatedChat, req.user._id) });
});

export const deleteChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, type: 'direct', members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  const memberIds = chat.members.map((memberId) => memberId.toString());
  await FriendRequest.deleteMany({
    $or: [
      { from: memberIds[0], to: memberIds[1] },
      { from: memberIds[1], to: memberIds[0] }
    ]
  });
  await Chat.deleteOne({ _id: chat._id });

  const io = req.app.get('io');
  memberIds.forEach((memberId) => io?.to(`user:${memberId}`).emit('chat:removed', { chatId: chat._id }));
  res.json({ ok: true });
});

export const hideChatFromFeed = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, type: 'direct', members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  chat.hiddenFor.addToSet(req.user._id);
  if (!chat.unreadCounts) chat.unreadCounts = new Map();
  chat.unreadCounts.set(req.user._id.toString(), 0);
  await chat.save();
  req.app.get('io')?.to(`user:${req.user._id}`).emit('chat:removed', { chatId: chat._id, hidden: true });
  res.json({ ok: true });
});

export const setChatArchived = asyncHandler(async (req, res) => {
  await updateChatPreference(req, res, 'archivedFor');
});

export const setChatPinned = asyncHandler(async (req, res) => {
  await updateChatPreference(req, res, 'pinnedFor');
});

export const setChatStarred = asyncHandler(async (req, res) => {
  await updateChatPreference(req, res, 'starredFor');
});

export const setChatMuted = asyncHandler(async (req, res) => {
  await updateChatPreference(req, res, 'mutedFor');
});

export const editMessage = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.chatId, deletedAt: { $exists: false } });
  if (!chat || !message || message.sender.toString() !== req.user._id.toString()) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }
  message.text = req.body.text;
  message.editedAt = new Date();
  await message.save();
  const populated = await populateMessage(message._id);
  req.app.get('io')?.to(`chat:${chat._id}`).emit('message:edited', { message: populated });
  res.json({ message: populated });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.chatId });
  if (!chat || !message) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }

  const scope = req.query.scope === 'everyone' ? 'everyone' : 'me';
  if (scope === 'everyone') {
    if (message.sender.toString() !== req.user._id.toString()) {
      const error = new Error('Only the sender can delete for everyone');
      error.status = 403;
      throw error;
    }
    message.deletedAt = new Date();
    await message.save();
    req.app.get('io')?.to(`chat:${chat._id}`).emit('message:deleted', { messageId: message._id, scope: 'everyone' });
    return res.json({ ok: true });
  }

  message.deletedFor.addToSet(req.user._id);
  await message.save();
  req.app.get('io')?.to(`user:${req.user._id}`).emit('message:deleted', { messageId: message._id, scope: 'me' });
  res.json({ ok: true });
});
