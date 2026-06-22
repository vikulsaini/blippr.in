import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. Get incoming pending requests (Authenticated)
router.get('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    if (!requests || requests.length === 0) {
      res.status(200).json({ requests: [] });
      return;
    }

    // Resolve sender profiles
    const senderIds = requests.map((r) => r.sender_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url')
      .in('id', senderIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const formattedRequests = requests.map((r) => {
      const senderProfile = profileMap.get(r.sender_id);
      return {
        _id: r.id,
        from: senderProfile ? {
          _id: senderProfile.id,
          username: senderProfile.username,
          name: senderProfile.name,
          avatar_url: senderProfile.avatar_url,
        } : r.sender_id,
        to: r.receiver_id,
        status: r.status,
        createdAt: r.created_at || new Date().toISOString(),
      };
    });

    res.status(200).json({ requests: formattedRequests });
  } catch (err) {
    console.error('[Friends API] Error getting incoming requests:', err);
    res.status(200).json({ requests: [] });
  }
});

// 2. Get outgoing pending requests (Authenticated)
router.get('/requests/sent', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    if (!requests || requests.length === 0) {
      res.status(200).json({ requests: [] });
      return;
    }

    // Resolve recipient profiles
    const receiverIds = requests.map((r) => r.receiver_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url')
      .in('id', receiverIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const formattedRequests = requests.map((r) => {
      const receiverProfile = profileMap.get(r.receiver_id);
      return {
        _id: r.id,
        to: receiverProfile ? {
          _id: receiverProfile.id,
          username: receiverProfile.username,
          name: receiverProfile.name,
          avatar_url: receiverProfile.avatar_url,
        } : r.receiver_id,
        from: r.sender_id,
        status: r.status,
        createdAt: r.created_at || new Date().toISOString(),
      };
    });

    res.status(200).json({ requests: formattedRequests });
  } catch (err) {
    console.error('[Friends API] Error getting sent requests:', err);
    res.status(200).json({ requests: [] });
  }
});

// 3. Send friend request (Authenticated)
router.post('/requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId } = req.body; // Recipient

  if (!senderId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!userId) {
    res.status(400).json({ error: 'Target userId is required.' });
    return;
  }
  if (senderId === userId) {
    res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    return;
  }

  try {
    // Check if request or friendship already exists
    const { data: existing, error: checkError } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${senderId})`)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      if (existing.status === 'accepted') {
        res.status(400).json({ error: 'You are already friends.' });
        return;
      }
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'A friend request is already pending between you.' });
        return;
      }
      // If rejected, allow sending a new request by deleting the old one first
      await supabase.from('friend_requests').delete().eq('id', existing.id);
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: userId,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(200).json({ success: true, request: newRequest });
  } catch (err) {
    console.error('[Friends API] Error sending request:', err);
    res.status(500).json({ error: 'Failed to send friend request.' });
  }
});

// 4. Cancel pending outgoing friend request (Authenticated)
router.delete('/requests/sent/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?.id;
  const { userId } = req.params;

  if (!senderId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', senderId)
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Friend request cancelled' });
  } catch (err) {
    console.error('[Friends API] Error cancelling request:', err);
    res.status(500).json({ error: 'Failed to cancel friend request' });
  }
});

// 5. Accept/Reject friend request (Authenticated)
router.patch('/requests/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const receiverId = req.user?.id;
  const { id } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!receiverId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (status !== 'accepted' && status !== 'rejected') {
    res.status(400).json({ error: 'Invalid status update. Must be accepted or rejected.' });
    return;
  }

  try {
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .eq('receiver_id', receiverId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!request) {
      res.status(404).json({ error: 'Friend request not found.' });
      return;
    }

    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', id);

    if (updateError) throw updateError;

    if (status === 'accepted') {
      // Create a direct chat room for these friends
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (roomError) {
        console.error('[Friends API] Failed to create chat room:', roomError.message);
      } else if (room) {
        const { error: membersError } = await supabase
          .from('room_members')
          .insert([
            { room_id: room.id, user_id: request.sender_id },
            { room_id: room.id, user_id: receiverId }
          ]);

        if (membersError) {
          console.error('[Friends API] Failed to insert room members:', membersError.message);
        }
      }
    }

    res.status(200).json({ success: true, status });
  } catch (err) {
    console.error('[Friends API] Error updating request status:', err);
    res.status(500).json({ error: 'Failed to update friend request.' });
  }
});

// 6. Delete friendship / Unfriend (Authenticated)
router.delete('/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { userId: targetId } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Delete any accepted friend request records
    await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`);

    // Clean up direct rooms shared by both users to clear the conversation
    const { data: userRooms } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId);

    const { data: targetRooms } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', targetId);

    if (userRooms && targetRooms) {
      const userRoomIds = new Set(userRooms.map((rm) => rm.room_id));
      const sharedRoomIds = targetRooms.map((rm) => rm.room_id).filter((id) => userRoomIds.has(id));

      if (sharedRoomIds.length > 0) {
        // Delete rooms (cascading deletes will handle members/messages)
        await supabase
          .from('rooms')
          .delete()
          .in('id', sharedRoomIds);
      }
    }

    res.status(200).json({ success: true, message: 'Unfriended successfully' });
  } catch (err) {
    console.error('[Friends API] Error unfriending:', err);
    res.status(500).json({ error: 'Failed to unfriend user.' });
  }
});

export default router;
