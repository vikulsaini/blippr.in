import { Server, Socket } from 'socket.io';
import { redisClient } from '../../config/redis.js';

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
        
        // Notify both parties of the match
        socket.emit('stranger:matched', { peerId: matchedPeerId });
        socket.to(matchedPeerId).emit('stranger:matched', { peerId: userId });
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
