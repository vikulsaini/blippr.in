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
    publicId: Joi.string().optional()
  }).optional()
}).or('text', 'media');

export const reactionSchema = Joi.object({
  emoji: Joi.string().min(1).max(8).required()
});

export const nicknameSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  nickname: Joi.string().trim().max(40).allow('').required()
});

function withUnreadCount(chat, userId) {
  const item = chat.toObject ? chat.toObject({ flattenMaps: true }) : chat;
  item.unreadCount = chat.unreadCounts?.get(userId.toString()) || 0;
  return item;
}

async function populateMessage(messageId) {
  return Message.findById(messageId)
    .populate('sender', 'name username avatar')
    .populate('replyTo', 'text sender');
}

export const listChats = asyncHandler(async (req, res) => {
  const usersBlockingMe = await User.find({ blockedUsers: req.user._id }).select('_id');
  const hiddenMemberIds = [
    ...(req.user.blockedUsers || []),
    ...usersBlockingMe.map((user) => user._id)
  ];
  const chats = await Chat.find({
    $and: [
      { members: req.user._id },
      { members: { $nin: hiddenMemberIds } }
    ]
  })
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall')
    .sort('-updatedAt');
  res.json({
    chats: chats.map((chat) => withUnreadCount(chat, req.user._id))
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
  const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }
  const messages = await Message.find({ chat: chat._id, deletedFor: { $ne: req.user._id }, deletedAt: { $exists: false } })
    .populate('sender', 'name username avatar')
    .populate('replyTo', 'text sender')
    .sort('-createdAt')
    .limit(80);
  res.json({ messages: messages.reverse() });
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
  const createdMessage = await Message.create({ chat: chat._id, sender: req.user._id, ...req.body });
  const message = await populateMessage(createdMessage._id);
  chat.lastMessage = createdMessage._id;
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
  const io = req.app.get('io');
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

export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message || message.sender.toString() !== req.user._id.toString()) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }
  message.deletedAt = new Date();
  await message.save();
  res.json({ ok: true });
});
