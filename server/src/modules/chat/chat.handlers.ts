import { Server, Socket } from 'socket.io';
import { supabase } from '../../config/supabase.js';

interface TypingPayload {
  targetUserId: string;
  isTyping: boolean;
}

interface LocationPayload {
  targetUserId: string;
  latitude: number;
  longitude: number;
}

interface TransientMessagePayload {
  targetUserId: string;
  content: string;
}

interface PersistentMessagePayload {
  targetUserId: string;
  content: string;
  roomId?: string;
}

export const registerChatHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    return;
  }

  // 1. Join Chat Room
  socket.on('chat:join', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.join(chatId);
      console.log(`[Socket] User ${userId} joined room ${chatId}`);
    }
  });

  // 2. Leave Chat Room
  socket.on('chat:leave', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.leave(chatId);
      console.log(`[Socket] User ${userId} left room ${chatId}`);
    }
  });

  // 3. Relay typing status
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

  // 4. Typing status indicator
  socket.on('chat:typing', (payload: TypingPayload) => {
    const { targetUserId, isTyping } = payload;
    if (!targetUserId) {
      return;
    }

    socket.to(targetUserId).emit('chat:typing', {
      senderId: userId,
      isTyping,
    });
  });

  // 5. Real-time location sharing
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

  // 6. Transient Messaging (Real-time only, no database storage)
  socket.on('chat:transient_message', (payload: TransientMessagePayload) => {
    const { targetUserId, content } = payload;
    if (!targetUserId || !content) {
      return;
    }

    socket.to(targetUserId).emit('chat:transient_message', {
      senderId: userId,
      content,
      timestamp: new Date().toISOString(),
    });
  });

  // 7. Persistent Messaging (Broadcasts instantly, persists in background to Supabase)
  socket.on('chat:persistent_message', async (payload: PersistentMessagePayload) => {
    const { targetUserId, content, roomId } = payload;
    if (!targetUserId || !content) {
      return;
    }

    const timestamp = new Date().toISOString();

    // Broadcast instantly to peer for low-latency response
    socket.to(targetUserId).emit('chat:persistent_message', {
      senderId: userId,
      content,
      roomId,
      timestamp,
    });

    // Persist to Supabase Database
    if (roomId) {
      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            sender_id: userId,
            content,
            created_at: timestamp,
          });

        if (error) {
          console.error(`[Chat] Supabase insert error: ${error.message}`);
        }
      } catch (err) {
        console.error('[Chat] Database connection error during message sync:', err);
      }
    }
  });

  // 8. General/Stranger messaging (client emits 'message:send', expects ack with { ok, message })
  socket.on('message:send', async (payload: { chatId: string; text: string }, ack?: (response: any) => void) => {
    const { chatId, text } = payload;
    if (!chatId || !text) {
      if (ack) ack({ ok: false, message: 'Invalid message payload' });
      return;
    }

    const timestamp = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const message = {
      _id: msgId,
      chat: chatId,
      sender: userId,
      text,
      reactions: [],
      status: 'sent',
      createdAt: timestamp,
    };

    // Broadcast message to other peer in the room
    socket.to(chatId).emit('message:new', { message });

    // Store in Supabase in background (fail silently)
    try {
      await supabase.from('messages').insert({
        id: msgId,
        room_id: chatId,
        sender_id: userId,
        content: text,
        created_at: timestamp,
      });
    } catch (dbErr) {
      console.error('[Chat Sockets] Failed to persist message:', dbErr);
    }

    if (ack) {
      ack({ ok: true, message });
    }
  });
};
