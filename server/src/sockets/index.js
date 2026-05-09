import Chat from '../models/Chat.js';
import Call from '../models/Call.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { findOrQueueUser, leaveQueues } from '../services/matchmaking.service.js';
import { notifyUser } from '../services/notification.service.js';
import { socketAuth } from './auth.socket.js';

const CALL_RING_TIMEOUT_MS = 45000;

function callPeerId(call, userId) {
  if (!call) return null;
  if (call.caller.toString() === userId) return call.receiver.toString();
  if (call.receiver.toString() === userId) return call.caller.toString();
  return null;
}

async function findDirectChatBetween(userId, peerId) {
  if (!peerId || peerId === userId) return null;
  return Chat.findOne({ type: 'direct', temporary: { $ne: true }, members: { $all: [userId, peerId] } });
}

async function emitCallChatUpdate(io, call) {
  if (!call?.chat) return;
  const chatId = call.chat._id || call.chat;
  const chat = await Chat.findByIdAndUpdate(chatId, { lastCall: call._id }, { new: true })
    .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
    .populate('lastMessage')
    .populate('lastCall');
  if (!chat) return;
  chat.members.forEach((member) => {
    const memberId = member._id.toString();
    io.to(`user:${memberId}`).emit('chat:updated', {
      chat,
      unreadCount: chat.unreadCounts?.get(memberId) || 0
    });
  });
}

function emitCallUpdate(io, userId, peerId, call) {
  io.to(`user:${peerId}`).emit('call:updated', { call });
  io.to(`user:${userId}`).emit('call:updated', { call });
  emitCallChatUpdate(io, call);
}

function deliveryReceiptsFor(io, chat, senderId) {
  return chat.members
    .filter((memberId) => memberId.toString() !== senderId.toString())
    .map((memberId) => {
      const connected = (io.sockets.adapter.rooms.get(`user:${memberId}`)?.size || 0) > 0;
      return {
        user: memberId,
        status: connected ? 'delivered' : 'sent',
        deliveredAt: connected ? new Date() : undefined
      };
    });
}

function applyBlockedWords(text = '', blockedWords = []) {
  return blockedWords.reduce((value, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? value.replace(new RegExp(escaped, 'gi'), '***') : value;
  }, text);
}

async function markMissedCallIfStillRinging(io, callId) {
  const current = await Call.findById(callId);
  if (!current || current.status !== 'ringing') return;

  const call = await Call.findByIdAndUpdate(
    current._id,
    { status: 'missed', endedAt: new Date(), durationSeconds: 0 },
    { new: true }
  )
    .populate('caller', 'name username avatar')
    .populate('receiver', 'name username avatar');

  const callerId = call.caller._id.toString();
  const receiverId = call.receiver._id.toString();
  emitCallUpdate(io, callerId, receiverId, call);
  io.to(`user:${callerId}`).emit('call:end', { from: receiverId, callId: call._id });
  io.to(`user:${receiverId}`).emit('call:end', { from: callerId, callId: call._id });
}

export function registerSockets(io) {
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const typingState = new Map();
    socket.join(`user:${userId}`);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeenAt: new Date() });
    socket.broadcast.emit('presence:update', { userId, isOnline: true });

    socket.on('chat:join', async ({ chatId }) => {
      const chat = await Chat.findOne({ _id: chatId, members: socket.user._id });
      if (chat) socket.join(`chat:${chatId}`);
    });

    socket.on('message:send', async ({ chatId, text, media }, ack) => {
      try {
        const chat = await Chat.findOne({ _id: chatId, members: socket.user._id });
        if (!chat) throw new Error('Chat not found');
      const delivered = chat.members
        .filter((memberId) => memberId.toString() !== socket.user._id.toString())
        .some((memberId) => (io.sockets.adapter.rooms.get(`user:${memberId}`)?.size || 0) > 0);
      const createdMessage = await Message.create({
        chat: chat._id,
        sender: socket.user._id,
        text: applyBlockedWords(text || '', socket.user.safety?.blockedWords || []),
        media,
        status: delivered ? 'delivered' : 'sent',
        deliveryReceipts: deliveryReceiptsFor(io, chat, socket.user._id)
      });
      const message = await Message.findById(createdMessage._id)
        .populate('sender', 'name username avatar')
        .populate('replyTo', 'text sender');
      chat.lastMessage = createdMessage._id;
        chat.hiddenFor = [];
        if (!chat.unreadCounts) chat.unreadCounts = new Map();
        for (const memberId of chat.members) {
          const key = memberId.toString();
          const current = chat.unreadCounts?.get(key) || 0;
          chat.unreadCounts.set(key, key === userId ? 0 : current + 1);
        }
        await chat.save();
        const populatedChat = await Chat.findById(chat._id)
          .populate('members', 'name username avatar bio age gender phone email isOnline lastSeenAt')
          .populate('lastMessage');
        io.to(`chat:${chatId}`).emit('message:new', { message });
        for (const memberId of chat.members) {
          io.to(`user:${memberId}`).emit('chat:updated', {
            chat: populatedChat,
            unreadCount: chat.unreadCounts?.get(memberId.toString()) || 0
          });
        }
        const notifications = await Promise.all(
          chat.members
            .filter((memberId) => memberId.toString() !== userId)
            .filter((memberId) => !(chat.mutedFor || []).some((mutedId) => mutedId.toString() === memberId.toString()))
            .map((memberId) =>
              notifyUser(memberId, {
                title: socket.user.name,
                body: text || 'Sent a media message',
                url: `/app?chat=${chatId}`,
                type: 'message',
                chatId,
                messageId: message._id,
                actor: userId
              })
            )
        );
        notifications.forEach((result, index) => {
          const memberId = chat.members.filter((id) => id.toString() !== userId)[index];
          if (result?.notification && memberId) io.to(`user:${memberId}`).emit('notification:new', { notification: result.notification });
        });
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on('message:delivered', async ({ messageId }) => {
      const message = await Message.findOneAndUpdate(
        { _id: messageId, 'deliveryReceipts.user': socket.user._id },
        {
          $set: {
            status: 'delivered',
            'deliveryReceipts.$.status': 'delivered',
            'deliveryReceipts.$.deliveredAt': new Date()
          }
        },
        { new: true }
      );
      if (message) io.to(`chat:${message.chat}`).emit('message:status', { messageId, status: message.status });
    });

    socket.on('message:seen', async ({ messageId }) => {
      const message = await Message.findOneAndUpdate(
        { _id: messageId, 'deliveryReceipts.user': socket.user._id },
        {
          $addToSet: { seenBy: socket.user._id },
          $set: {
            status: 'seen',
            'deliveryReceipts.$.status': 'seen',
            'deliveryReceipts.$.seenAt': new Date()
          }
        },
        { new: true }
      );
      if (message) io.to(`chat:${message.chat}`).emit('message:status', { messageId, status: message.status });
    });

    function stopTyping(chatId) {
      const state = typingState.get(chatId);
      if (!state) return;
      clearTimeout(state.timer);
      typingState.delete(chatId);
      socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
    }

    socket.on('typing:start', ({ chatId }) => {
      if (!chatId) return;
      const state = typingState.get(chatId);
      if (!state) socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId });
      clearTimeout(state?.timer);
      typingState.set(chatId, {
        timer: setTimeout(() => stopTyping(chatId), 1800)
      });
    });
    socket.on('typing:stop', ({ chatId }) => {
      if (chatId) stopTyping(chatId);
    });

    socket.on('stranger:find', async ({ interests = [] }, ack) => {
      const result = await findOrQueueUser(socket.user, interests);
      if (result.matched) {
        socket.join(result.roomId);
        io.to(`user:${result.chat.members.find((id) => id.toString() !== userId)}`).emit('stranger:matched', {
          chat: result.chat
        });
      }
      ack?.(result);
    });

    socket.on('stranger:next', async (payload, ack) => {
      await leaveQueues(userId);
      const result = await findOrQueueUser(socket.user, payload?.interests || []);
      ack?.(result);
    });

    socket.on('call:offer', async ({ to, offer, callType }, ack) => {
      const chat = await Chat.findOne({ type: 'direct', members: { $all: [userId, to] } });
      if (!chat || chat.temporary) {
        ack?.({ ok: false, message: 'Calls are available only with friends' });
        return;
      }
      const call = await Call.create({ caller: userId, receiver: to, chat: chat?._id, type: callType === 'audio' ? 'audio' : 'video' });
      await emitCallChatUpdate(io, call);
      io.to(`user:${to}`).emit('call:incoming', {
        callId: call._id,
        chatId: chat?._id,
        from: userId,
        fromUser: {
          _id: socket.user._id,
          name: socket.user.name,
          username: socket.user.username,
          avatar: socket.user.avatar
        },
        offer,
        callType: call.type
      });
      const { notification } = await notifyUser(to, {
        title: `${socket.user.name} is calling`,
        body: `${call.type === 'video' ? 'Video' : 'Audio'} call on Varta`,
        url: `/app?chat=${chat._id}`,
        type: 'call',
        chatId: chat._id,
        callId: call._id,
        actor: userId
      });
      io.to(`user:${to}`).emit('notification:new', { notification });
      setTimeout(() => {
        markMissedCallIfStillRinging(io, call._id).catch((error) => {
          console.warn(`Failed to mark missed call: ${error.message}`);
        });
      }, CALL_RING_TIMEOUT_MS);
      ack?.({ ok: true, callId: call._id });
    });
    socket.on('call:answer', async ({ to, answer, callId }, ack) => {
      if (!callId) {
        ack?.({ ok: false, message: 'Call not found' });
        return;
      }
      const existingCall = await Call.findOne({ _id: callId, receiver: userId, status: 'ringing' });
      const peerId = callPeerId(existingCall, userId);
      if (!existingCall || peerId !== to || !(await findDirectChatBetween(userId, peerId))) {
        ack?.({ ok: false, message: 'Call is no longer available' });
        return;
      }
      const call = await Call.findByIdAndUpdate(existingCall._id, { status: 'accepted', answeredAt: new Date() }, { new: true })
        .populate('caller', 'name username avatar')
        .populate('receiver', 'name username avatar');
      emitCallUpdate(io, userId, peerId, call);
      io.to(`user:${peerId}`).emit('call:answer', { from: userId, answer, callId });
      ack?.({ ok: true, callId });
    });
    socket.on('call:ice-candidate', async ({ to, candidate, callId }) => {
      const chat = await findDirectChatBetween(userId, to);
      if (chat) io.to(`user:${to}`).emit('call:ice-candidate', { from: userId, candidate, callId });
    });
    socket.on('call:reject', async ({ to, callId }) => {
      if (callId) {
        const existingCall = await Call.findOne({ _id: callId, $or: [{ caller: userId }, { receiver: userId }] });
        const peerId = callPeerId(existingCall, userId);
        if (!existingCall || peerId !== to || !(await findDirectChatBetween(userId, peerId))) return;
        const endedAt = new Date();
        const call = await Call.findByIdAndUpdate(existingCall._id, { status: 'rejected', endedAt, durationSeconds: 0 }, { new: true })
          .populate('caller', 'name username avatar')
          .populate('receiver', 'name username avatar');
        emitCallUpdate(io, userId, peerId, call);
        io.to(`user:${peerId}`).emit('call:reject', { from: userId, callId });
      }
    });
    socket.on('call:end', async ({ to, callId }) => {
      if (callId) {
        const current = await Call.findOne({ _id: callId, $or: [{ caller: userId }, { receiver: userId }] });
        const peerId = callPeerId(current, userId);
        if (!current || peerId !== to || !(await findDirectChatBetween(userId, peerId))) return;
        const endedAt = new Date();
        const durationSeconds = current?.answeredAt ? Math.max(0, Math.round((endedAt - current.answeredAt) / 1000)) : 0;
        const status = current?.answeredAt ? 'ended' : 'missed';
        const call = await Call.findByIdAndUpdate(current._id, { status, endedAt, durationSeconds }, { new: true })
          .populate('caller', 'name username avatar')
          .populate('receiver', 'name username avatar');
        emitCallUpdate(io, userId, peerId, call);
        io.to(`user:${peerId}`).emit('call:end', { from: userId, callId });
      }
    });

    socket.on('disconnect', async () => {
      for (const chatId of typingState.keys()) stopTyping(chatId);
      await leaveQueues(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt: new Date() });
      socket.broadcast.emit('presence:update', { userId, isOnline: false });
    });
  });
}
