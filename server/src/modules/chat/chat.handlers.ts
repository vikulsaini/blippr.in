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

  // 1. Typing status indicator
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

  // 2. Real-time location sharing
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

  // 3. Transient Messaging (Real-time only, no database storage)
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

  // 4. Persistent Messaging (Broadcasts instantly, persists in background to Supabase)
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
};
