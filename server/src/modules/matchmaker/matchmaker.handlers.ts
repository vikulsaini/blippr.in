import { Server, Socket } from 'socket.io';
import { redisClient } from '../../config/redis.js';
import { supabase } from '../../config/supabase.js';

const QUEUE_KEY = 'varta:matchmaking:queue';

export const registerMatchmakerHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    return;
  }

  // Join the user's private signaling room if they haven't already
  socket.join(userId);

  const leaveQueue = async (): Promise<void> => {
    try {
      await redisClient.lRem(QUEUE_KEY, 0, userId);
      console.log(`[Matchmaker] User ${userId} removed from queue`);
    } catch (err) {
      console.error(`[Matchmaker] Error removing ${userId} from queue:`, err);
    }
  };

  const handleJoin = async (ack?: (response: any) => void) => {
    try {
      console.log(`[Matchmaker] User ${userId} requested to join matchmaking queue`);

      // Prevent duplicate queue entries
      await redisClient.lRem(QUEUE_KEY, 0, userId);

      let matchedPeerId: string | null = null;
      let foundActivePeer = false;

      // Pop users from the queue until we find an active online peer or empty the queue
      while (!foundActivePeer) {
        const peerId = await redisClient.lPop(QUEUE_KEY);
        if (!peerId) {
          break; // Queue is empty
        }

        if (peerId === userId) {
          continue; // Avoid matching with oneself
        }

        // Verify that the peer is actually still online and connected
        const activeSockets = await io.in(peerId).fetchSockets();
        if (activeSockets.length > 0) {
          matchedPeerId = peerId;
          foundActivePeer = true;
        } else {
          console.log(`[Matchmaker] Discarded offline queued user: ${peerId}`);
        }
      }

      if (ack) {
        ack({ ok: true });
      }

      if (matchedPeerId) {
        console.log(`[Matchmaker] MATCH CREATED: ${userId} <-> ${matchedPeerId}`);

        // Create a room and add both users as members
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const timestamp = new Date().toISOString();

        // 1. Create Room and Members in Supabase (run in background, fallback if DB fails)
        try {
          await supabase.from('rooms').insert({ id: roomId, updated_at: timestamp });
          await supabase.from('room_members').insert([
            { room_id: roomId, user_id: userId },
            { room_id: roomId, user_id: matchedPeerId },
          ]);
        } catch (dbErr) {
          console.error('[Matchmaker] Supabase room insertion failed:', dbErr);
        }

        // 2. Load User Profiles to construct client payload
        let userProfile: any = { id: userId, name: 'Guest User', username: 'guest', avatar_url: '', gender: 'other', bio: '' };
        let peerProfile: any = { id: matchedPeerId, name: 'Guest User', username: 'guest', avatar_url: '', gender: 'other', bio: '' };

        try {
          const { data: profiles, error: profileErr } = await supabase
            .from('profiles')
            .select('id, name, username, gender, bio') // Bypassing avatar_url to prevent 42703 error if column is missing
            .in('id', [userId, matchedPeerId]);

          if (profiles && !profileErr) {
            const userDb = profiles.find((p) => p.id === userId);
            const peerDb = profiles.find((p) => p.id === matchedPeerId);

            if (userDb) {
              userProfile = { ...userProfile, ...userDb, _id: userDb.id };
            }
            if (peerDb) {
              peerProfile = { ...peerProfile, ...peerDb, _id: peerDb.id };
            }
          }
        } catch (profileFetchErr) {
          console.error('[Matchmaker] Profiles fetch failed:', profileFetchErr);
        }

        // Add client-expected _id to profile objects
        const formattedUser = { ...userProfile, _id: userProfile.id };
        const formattedPeer = { ...peerProfile, _id: peerProfile.id };

        const chatPayload = {
          _id: roomId,
          type: 'direct',
          temporary: true,
          createdAt: timestamp,
        };

        // Notify both parties of the match with client-expected properties (chat, peer, initiator)
        io.to(userId).emit('stranger:matched', {
          chat: chatPayload,
          peer: formattedPeer,
          initiator: true,
        });

        io.to(matchedPeerId).emit('stranger:matched', {
          chat: chatPayload,
          peer: formattedUser,
          initiator: false,
        });
      } else {
        // Enqueue user
        await redisClient.rPush(QUEUE_KEY, userId);
        socket.emit('stranger:waiting');
        console.log(`[Matchmaker] User ${userId} waiting in queue`);
      }
    } catch (err) {
      console.error('[Matchmaker] Error during matchmaking:', err);
      socket.emit('stranger:error', { message: 'Failed to process matchmaking request' });
    }
  };

  // 1. Listen for client requests to search for stranger
  socket.on('stranger:find', async (data: any, ack?: (response: any) => void) => {
    await handleJoin(ack);
  });

  // 2. Listen for client requests to skip/next to next stranger
  socket.on('stranger:next', async (payload: { chatId?: string }, ack?: (response: any) => void) => {
    const { chatId } = payload;
    
    // Notify the other stranger that this user skipped
    if (chatId) {
      socket.to(chatId).emit('stranger:left', { chatId });
      console.log(`[Matchmaker] User ${userId} skipped room ${chatId}`);
    }

    // Leave the socket room
    if (chatId) {
      socket.leave(chatId);
    }

    // Remove from queue and find another match
    await leaveQueue();
    await handleJoin(ack);
  });

  // 3. User cancels/leaves the matchmaking queue
  socket.on('stranger:leave', async () => {
    await leaveQueue();
    socket.emit('stranger:left');
  });

  // 4. Return count of active users on stranger matching page
  socket.on('stranger:stats', (ack: (result: { ok: boolean; activeUsers: number }) => void) => {
    try {
      const activeUsers = io.engine.clientsCount || 1;
      ack({ ok: true, activeUsers });
    } catch (err) {
      ack({ ok: false, activeUsers: 1 });
    }
  });

  // 5. Relaying WebRTC signal candidates
  socket.on('stranger:signal', (payload: { chatId: string; to: string; type: string; payload: any }, ack?: (response: any) => void) => {
    const { chatId, to, type, payload: signalPayload } = payload;
    if (!to || !type) {
      if (ack) ack({ ok: false, message: 'Invalid signal parameters' });
      return;
    }

    console.log(`[Matchmaker] Relaying stranger signal (${type}) from ${userId} -> ${to}`);

    // Relay signal directly to the recipient's private socket room
    socket.to(to).emit('stranger:signal', {
      chatId,
      from: userId,
      type,
      payload: signalPayload,
    });

    if (ack) {
      ack({ ok: true });
    }
  });

  // 6. Cleanup queue position upon websocket disconnection
  socket.on('disconnect', async () => {
    await leaveQueue();
  });
};
