import { Server, Socket } from 'socket.io';
import { Profile } from '../../config/db.js';

interface CallOfferPayload {
  to: string;
  offer: unknown;
  callType: 'audio' | 'video';
}

interface CallAnswerPayload {
  to: string;
  answer: unknown;
  callId: string;
}

interface CallRejectPayload {
  to: string;
  callId: string;
}

interface CallEndPayload {
  to: string;
  callId: string;
}

interface CallIceCandidatePayload {
  to: string;
  candidate: unknown;
  callId: string;
}

interface CallResendPayload {
  to: string;
  callType: 'audio' | 'video';
}

export const registerCallHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    console.error('[Call] Handler registered without userId');
    return;
  }

  // Join the user's private signaling room for incoming calls
  socket.join(userId);
  console.log(`[Call] User ${userId} joined personal room for calls`);

  // Helper: check if a user is online (connected to socket.io)
  async function isUserOnline(targetUserId: string): Promise<boolean> {
    try {
      const sockets = await io.in(targetUserId).fetchSockets();
      return sockets.length > 0;
    } catch {
      return false;
    }
  }

  // 1. Client initiates call (SDP Offer)
  socket.on('call:offer', async (payload: CallOfferPayload, ack?: (response: unknown) => void) => {
    const { to, offer, callType } = payload;
    if (!to || !offer) {
      if (ack) ack({ error: 'Invalid offer parameters' });
      return;
    }

    // Check if recipient is online before attempting call
    const recipientOnline = await isUserOnline(to);
    if (!recipientOnline) {
      console.log(`[Call] Recipient ${to} is offline, cannot relay call from ${userId}`);
      if (ack) ack({ error: 'User is offline', offline: true });
      socket.emit('call:failed', { reason: 'User is offline', to });
      return;
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[Call] Relaying call offer from ${userId} -> ${to} (ID: ${callId}, Type: ${callType})`);

    // Fetch caller name and avatar from Database
    let callerName = 'Blippr User';
    let callerAvatar = '';

    try {
      const data = await Profile.findById(userId).select('name avatar_url').lean();
      if (data) {
        callerName = data.name || callerName;
        callerAvatar = data.avatar_url || '';
      }
    } catch (err) {
      console.error('[Call] Profile fetch failed:', err);
    }

    // Forward incoming call to recipient
    const sent = socket.to(to).emit('call:incoming', {
      from: userId,
      offer,
      callType,
      callId,
      callerName,
      callerAvatar,
    });

    if (ack) {
      ack({ ok: true, callId, sent });
    }

    // Schedule a timeout - if no answer/reject within 45 seconds, notify caller
    setTimeout(() => {
      // Check if call is still active (no answer or reject received yet)
      // The client handles its own timeout too
      console.log(`[Call] Call ${callId} from ${userId} to ${to} timed out (45s)`);
    }, 45000);
  });

  // 2. Client answers call (SDP Answer)
  socket.on('call:answer', (payload: CallAnswerPayload, ack?: (response: unknown) => void) => {
    const { to, answer, callId } = payload;
    if (!to || !answer || !callId) {
      if (ack) ack({ error: 'Invalid answer parameters' });
      return;
    }

    console.log(`[Call] Relaying answer from ${userId} -> ${to} (CallID: ${callId})`);

    socket.to(to).emit('call:answer', {
      answer,
      callId,
    });

    if (ack) {
      ack({ ok: true, success: true });
    }
  });

  // 3. Client rejects call
  socket.on('call:reject', (payload: CallRejectPayload) => {
    const { to, callId } = payload;
    if (!to || !callId) return;

    console.log(`[Call] Relaying reject from ${userId} -> ${to} (CallID: ${callId})`);

    socket.to(to).emit('call:reject', { callId });
  });

  // 4. Client ends active call
  socket.on('call:end', (payload: CallEndPayload) => {
    const { to, callId } = payload;
    if (!to || !callId) return;

    console.log(`[Call] Relaying end from ${userId} -> ${to} (CallID: ${callId})`);

    socket.to(to).emit('call:end', { callId });
  });

  // 5. Relay ICE Candidates
  socket.on('call:ice-candidate', (payload: CallIceCandidatePayload) => {
    const { to, candidate, callId } = payload;
    if (!to || !candidate || !callId) return;

    socket.to(to).emit('call:ice-candidate', {
      candidate,
      callId,
    });
  });

  // 6. Resend call offer (if recipient missed the first one)
  socket.on('call:resend', async (payload: CallResendPayload) => {
    const { to, callType } = payload;
    if (!to) return;

    const online = await isUserOnline(to);
    if (!online) {
      socket.emit('call:failed', { reason: 'User is offline', to });
      return;
    }

    // Re-fetch caller info
    let callerName = 'Blippr User';
    let callerAvatar = '';
    try {
      const data = await Profile.findById(userId).select('name avatar_url').lean();
      if (data) {
        callerName = data.name || callerName;
        callerAvatar = data.avatar_url || '';
      }
    } catch { /* ignore */ }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    socket.to(to).emit('call:incoming', {
      from: userId,
      offer: null, // Client will create a new offer
      callType,
      callId,
      callerName,
      callerAvatar,
      resent: true,
    });

    socket.emit('call:resent', { callId, to });
  });
};
