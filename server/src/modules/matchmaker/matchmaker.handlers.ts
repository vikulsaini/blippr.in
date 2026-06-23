import { Server, Socket } from 'socket.io';
import { redisClient } from '../../config/redis.js';
import { supabase } from '../../config/supabase.js';

const QUEUE_KEY = 'varta:matchmaking:queue';

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

  // 1. User joins the matchmaking queue
  socket.on('stranger:join', async () => {
    try {
      console.log(`[Matchmaker] User ${userId} requested to join matchmaking`);

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

      if (matchedPeerId) {
        console.log(`[Matchmaker] MATCH CREATED: ${userId} <-> ${matchedPeerId}`);

        // Create a room and add both users as members
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const timestamp = new Date().toISOString();
        let roomCreated = false;

        try {
          // Insert room
          const { error: roomError } = await supabase
            .from('rooms')
            .insert({ id: roomId, updated_at: timestamp });

          if (roomError) {
            console.error('[Matchmaker] Failed to create room:', JSON.stringify(roomError));
          } else {
            // Add both users as room members
            const { error: membersError } = await supabase
              .from('room_members')
              .insert([
                { room_id: roomId, user_id: userId },
                { room_id: roomId, user_id: matchedPeerId },
              ]);

            if (membersError) {
              console.error('[Matchmaker] Failed to add room members:', JSON.stringify(membersError));
            } else {
              roomCreated = true;
              console.log(`[Matchmaker] Room ${roomId} created with members ${userId} <-> ${matchedPeerId}`);
            }
          }
        } catch (err) {
          console.error('[Matchmaker] Error creating room:', err);
        }

        // Notify both parties of the match (include roomId only if room was created)
        const matchPayload = roomCreated ? { peerId: matchedPeerId, roomId } : { peerId: matchedPeerId };
        socket.emit('stranger:matched', matchPayload);
        socket.to(matchedPeerId).emit('stranger:matched', roomCreated ? { peerId: userId, roomId } : { peerId: userId });
      } else {
        // Enqueue user
        await redisClient.rPush(QUEUE_KEY, userId);
        socket.emit('stranger:waiting');
        console.log(`[Matchmaker] User ${userId} waiting in queue`);
      }
    } catch (err) {
      console.error('[Matchmaker] Error during stranger:join:', err);
      socket.emit('stranger:error', { message: 'Failed to process matchmaking request' });
    }
  });

  // 2. User cancels/leaves the matchmaking queue
  socket.on('stranger:leave', async () => {
    await leaveQueue();
    socket.emit('stranger:left');
  });

  // 3. Cleanup queue position upon websocket disconnection
  socket.on('disconnect', async () => {
    await leaveQueue();
  });
};
