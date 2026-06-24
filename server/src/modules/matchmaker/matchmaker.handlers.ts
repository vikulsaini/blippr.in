import { Server, Socket } from 'socket.io';
import { redisClient } from '../../config/redis.js';
import { Room, RoomMember, Profile, IProfile } from '../../config/db.js';

const QUEUE_KEY = 'varta:matchmaking:queue';

interface ProfilePayload {
  id: string;
  _id: string;
  name: string;
  username: string;
  avatar_url: string;
  gender: string;
  bio: string;
}

interface StrangerSignalPayload {
  chatId: string;
  to: string;
  type: string;
  payload: unknown;
}

export const registerMatchmakerHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    return;
  }

  const leaveQueue = async (): Promise<void> => {
    try {
      await redisClient.lRem(QUEUE_KEY, 0, userId);
      console.log(`[Matchmaker] User ${userId} removed from queue`);
    } catch (err) {
      console.error(`[Matchmaker] Error removing ${userId} from queue:`, err);
    }
  };

  const buildProfilePayload = (profile: IProfile | undefined, fallbackId: string): ProfilePayload => {
    const id = profile?._id || fallbackId;
    return {
      id,
      _id: id,
      name: profile?.name || 'Guest User',
      username: profile?.username || 'guest',
      avatar_url: profile?.avatar_url || '',
      gender: profile?.gender || 'other',
      bio: profile?.bio || '',
    };
  };

  const handleJoin = async (ack?: (response: unknown) => void) => {
    try {
      console.log(`[Matchmaker] User ${userId} requested to join matchmaking queue`);

      // Prevent duplicate queue entries
      await redisClient.lRem(QUEUE_KEY, 0, userId);

      let matchedPeerId: string | null = null;
      let foundActivePeer = false;

      // Pop users from the queue until we find an active online peer or empty the queue
      while (!foundActivePeer) {
        const peerId = await redisClient.lPop(QUEUE_KEY);
        if (!peerId) break; // Queue is empty
        if (peerId === userId) continue; // Avoid matching with oneself

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

        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const timestamp = new Date().toISOString();

        // Create Room and Members in Database
        try {
          await Room.create({ _id: roomId, updated_at: timestamp });
          await RoomMember.create([
            { room_id: roomId, user_id: userId },
            { room_id: roomId, user_id: matchedPeerId },
          ]);
        } catch (dbErr) {
          console.error('[Matchmaker] Room insertion failed:', dbErr);
        }

        // Load User Profiles
        let userProfile: ProfilePayload;
        let peerProfile: ProfilePayload;

        try {
          const profiles = await Profile.find({ _id: { $in: [userId, matchedPeerId] } }).lean();
          const userDb = profiles.find((p) => p._id === userId);
          const peerDb = profiles.find((p) => p._id === matchedPeerId);

          userProfile = buildProfilePayload(userDb, userId);
          peerProfile = buildProfilePayload(peerDb, matchedPeerId);
        } catch (profileFetchErr) {
          console.error('[Matchmaker] Profiles fetch failed:', profileFetchErr);
          userProfile = buildProfilePayload(undefined, userId);
          peerProfile = buildProfilePayload(undefined, matchedPeerId);
        }

        const chatPayload = {
          _id: roomId,
          type: 'direct',
          temporary: true,
          createdAt: timestamp,
        };

        // Notify both parties of the match
        io.to(userId).emit('stranger:matched', {
          chat: chatPayload,
          peer: peerProfile,
          initiator: true,
        });

        io.to(matchedPeerId).emit('stranger:matched', {
          chat: chatPayload,
          peer: userProfile,
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

  // 1. Search for stranger
  socket.on('stranger:find', (_data: unknown, ack?: (response: unknown) => void) => {
    handleJoin(ack);
  });

  // 2. Skip/next to next stranger
  socket.on('stranger:next', async (payload: { chatId?: string }, ack?: (response: unknown) => void) => {
    const { chatId } = payload;

    // Notify the other stranger that this user skipped
    if (chatId) {
      socket.to(chatId).emit('stranger:left', { chatId });
      console.log(`[Matchmaker] User ${userId} skipped room ${chatId}`);
      socket.leave(chatId);
    }

    await leaveQueue();
    await handleJoin(ack);
  });

  // 3. Cancel/leave matchmaking queue
  socket.on('stranger:leave', async () => {
    await leaveQueue();
    socket.emit('stranger:left');
  });

  // 4. Return count of active users
  socket.on('stranger:stats', (ack: (result: { ok: boolean; activeUsers: number }) => void) => {
    try {
      const activeUsers = io.engine.clientsCount || 1;
      ack({ ok: true, activeUsers });
    } catch {
      ack({ ok: false, activeUsers: 1 });
    }
  });

  // 5. Relay WebRTC signal candidates
  socket.on('stranger:signal', (payload: StrangerSignalPayload, ack?: (response: unknown) => void) => {
    const { chatId, to, type, payload: signalPayload } = payload;
    if (!to || !type) {
      if (ack) ack({ ok: false, message: 'Invalid signal parameters' });
      return;
    }

    console.log(`[Matchmaker] Relaying stranger signal (${type}) from ${userId} -> ${to}`);

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

  // 6. Cleanup queue position on websocket disconnection
  socket.on('disconnect', async () => {
    await leaveQueue();
  });
};
