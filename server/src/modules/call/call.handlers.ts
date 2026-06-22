import { Server, Socket } from 'socket.io';

interface InitiateCallPayload {
  targetUserId: string;
  offer: any;
}

interface AnswerCallPayload {
  targetUserId: string;
  answer: any;
}

interface IceCandidatePayload {
  targetUserId: string;
  candidate: any;
}

interface TerminateCallPayload {
  targetUserId: string;
}

export const registerCallHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    console.error('[Call Handlers] Attempted to register call handlers for unauthenticated socket');
    return;
  }

  // Join the user's private channel room named after their unique user ID.
  // This allows Socket.io to route messages directly to this specific user across clusters.
  socket.join(userId);
  console.log(`[Call] User ${userId} joined their private signaling room`);

  // 1. Initiate Call (Offer)
  socket.on('call:initiate', (payload: InitiateCallPayload) => {
    const { targetUserId, offer } = payload;
    if (!targetUserId || !offer) {
      socket.emit('call:error', { message: 'Invalid call setup payload' });
      return;
    }

    console.log(`[Call] User ${userId} is offering to call ${targetUserId}`);

    // Emit the offer to the target user room, using the authenticated socket.data.userId
    // to strictly prevent caller identity spoofing.
    socket.to(targetUserId).emit('call:offer', {
      callerId: userId,
      offer,
    });
  });

  // 2. Answer Call (Answer)
  socket.on('call:answer', (payload: AnswerCallPayload) => {
    const { targetUserId, answer } = payload;
    if (!targetUserId || !answer) {
      socket.emit('call:error', { message: 'Invalid call answer payload' });
      return;
    }

    console.log(`[Call] User ${userId} answered call from ${targetUserId}`);

    // Forward answer to the target user (the original caller)
    socket.to(targetUserId).emit('call:answer', {
      answererId: userId,
      answer,
    });
  });

  // 3. ICE Candidate Relay
  socket.on('call:ice_candidate', (payload: IceCandidatePayload) => {
    const { targetUserId, candidate } = payload;
    if (!targetUserId || !candidate) {
      socket.emit('call:error', { message: 'Invalid ICE candidate payload' });
      return;
    }

    // Forward ICE candidate to peer
    socket.to(targetUserId).emit('call:ice_candidate', {
      senderId: userId,
      candidate,
    });
  });

  // 4. Terminate Call
  socket.on('call:terminate', (payload: TerminateCallPayload) => {
    const { targetUserId } = payload;
    if (!targetUserId) {
      socket.emit('call:error', { message: 'Invalid termination payload' });
      return;
    }

    console.log(`[Call] User ${userId} terminated call with ${targetUserId}`);

    // Notify peer of termination
    socket.to(targetUserId).emit('call:terminated', {
      senderId: userId,
    });
  });
};
