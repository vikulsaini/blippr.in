import { Server, Socket } from 'socket.io';
import { Message } from '../../config/db.js';

interface TypingPayload {
  chatId: string;
  isTyping: boolean;
}

interface LocationPayload {
  targetUserId: string;
  latitude: number;
  longitude: number;
}

interface MessageSendPayload {
  chatId: string;
  text: string;
}

export const registerChatHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    return;
  }

  // 1. Join/Leave Chat Room
  socket.on('chat:join', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.join(chatId);
      console.log(`[Socket] User ${userId} joined room ${chatId}`);
    }
  });

  socket.on('chat:leave', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.leave(chatId);
      console.log(`[Socket] User ${userId} left room ${chatId}`);
    }
  });

  // 2. Unified typing indicators (room-based)
  socket.on('typing:start', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.to(chatId).emit('typing:start', { chatId, userId });
    }
  });

  socket.on('typing:stop', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.to(chatId).emit('typing:stop', { chatId, userId });
    }
  });

  // 3. Send message (persisted to DB and broadcast to room)
  socket.on('message:send', async (payload: MessageSendPayload, ack?: (response: any) => void) => {
    const { chatId, text } = payload;
    if (!chatId || !text) {
      if (ack) ack({ ok: false, message: 'Invalid message payload' });
      return;
    }

    const sanitizedText = text.trim().substring(0, 10000);
    if (!sanitizedText) {
      if (ack) ack({ ok: false, message: 'Message cannot be empty' });
      return;
    }

    const timestamp = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const message = {
      _id: msgId,
      chat: chatId,
      sender: userId,
      text: sanitizedText,
      reactions: [] as string[],
      status: 'sent',
      createdAt: timestamp,
    };

    // Broadcast to other peers in the room
    socket.to(chatId).emit('message:new', { message });

    // Persist to database (non-blocking)
    try {
      await Message.create({
        _id: msgId,
        room_id: chatId,
        sender_id: userId,
        content: sanitizedText,
        created_at: timestamp,
      });
    } catch (dbErr) {
      console.error('[Chat Sockets] Failed to persist message:', dbErr);
    }

    if (ack) {
      ack({ ok: true, message });
    }
  });

  // 4. Real-time location sharing
  socket.on('chat:location', (payload: LocationPayload) => {
    const { targetUserId, latitude, longitude } = payload;
    if (!targetUserId || latitude === undefined || longitude === undefined) {
      return;
    }

    socket.to(targetUserId).emit('chat:location', {
      senderId: userId,
      latitude,
      longitude,
    });
  });
};
