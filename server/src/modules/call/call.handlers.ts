import { Server, Socket } from 'socket.io';
import { supabase } from '../../config/supabase.js';

interface CallOfferPayload {
  to: string;
  offer: any;
  callType: 'audio' | 'video';
}

interface CallAnswerPayload {
  to: string;
  answer: any;
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
  candidate: any;
  callId: string;
}

export const registerCallHandlers = (io: Server, socket: Socket): void => {
  const userId = socket.data.userId;
  if (!userId) {
    return;
  }

  // Join the user's private signaling room
  socket.join(userId);

  // 1. Client initiates call (SDP Offer)
  socket.on('call:offer', async (payload: CallOfferPayload, ack?: (response: any) => void) => {
    const { to, offer, callType } = payload;
    if (!to || !offer) {
      if (ack) ack({ error: 'Invalid offer parameters' });
      return;
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[Call] Relaying call offer from ${userId} -> ${to} (ID: ${callId}, Type: ${callType})`);

    // Fetch caller name and avatar details from Supabase
    let callerName = 'Blippr User';
    let callerAvatar = '';

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        callerName = data.name || callerName;
        callerAvatar = data.avatar_url || '';
      }
    } catch (err) {
      console.error('[Call Handlers] Supabase profile fetch failed:', err);
    }

    // Forward incoming call to recipient
    socket.to(to).emit('call:incoming', {
      from: userId,
      offer,
      callType,
      callId,
      callerName,
      callerAvatar,
    });

    if (ack) {
      ack({ callId });
    }
  });

  // 2. Client answers call (SDP Answer)
  socket.on('call:answer', (payload: CallAnswerPayload, ack?: (response: any) => void) => {
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
      ack({ success: true });
    }
  });

  // 3. Client rejects call
  socket.on('call:reject', (payload: CallRejectPayload) => {
    const { to, callId } = payload;
    if (!to || !callId) {
      return;
    }

    console.log(`[Call] Relaying reject from ${userId} -> ${to} (CallID: ${callId})`);

    socket.to(to).emit('call:reject', {
      callId,
    });
  });

  // 4. Client ends active call
  socket.on('call:end', (payload: CallEndPayload) => {
    const { to, callId } = payload;
    if (!to || !callId) {
      return;
    }

    console.log(`[Call] Relaying end from ${userId} -> ${to} (CallID: ${callId})`);

    socket.to(to).emit('call:end', {
      callId,
    });
  });

  // 5. Relaying ICE Candidates
  socket.on('call:ice-candidate', (payload: CallIceCandidatePayload) => {
    const { to, candidate, callId } = payload;
    if (!to || !candidate || !callId) {
      return;
    }

    // Relay candidates directly to peer
    socket.to(to).emit('call:ice-candidate', {
      candidate,
      callId,
    });
  });
};
