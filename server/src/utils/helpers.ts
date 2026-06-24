import { RoomMember, FriendRequest, Room } from '../config/db.js';

export async function findMutualFriendRequest(userId1: string, userId2: string) {
  return await FriendRequest.findOne({
    $or: [
      { sender_id: userId1, receiver_id: userId2 },
      { sender_id: userId2, receiver_id: userId1 },
    ],
  }).lean();
}

export async function deleteMutualFriendRequests(userId1: string, userId2: string) {
  await FriendRequest.deleteMany({
    $or: [
      { sender_id: userId1, receiver_id: userId2 },
      { sender_id: userId2, receiver_id: userId1 },
    ],
  });
}

export async function findSharedRoomIds(userId1: string, userId2: string): Promise<string[]> {
  const rm1 = await RoomMember.find({ user_id: userId1 }).lean();
  const rm2 = await RoomMember.find({ user_id: userId2 }).lean();

  if (!rm1 || !rm2) return [];
  const userRoomIds = new Set(rm1.map((rm) => rm.room_id));
  return rm2.map((rm) => rm.room_id).filter((id) => userRoomIds.has(id));
}

export async function cleanupSharedRooms(userId1: string, userId2: string) {
  const sharedRoomIds = await findSharedRoomIds(userId1, userId2);
  if (sharedRoomIds.length > 0) {
    await Room.deleteMany({ _id: { $in: sharedRoomIds } });
    await RoomMember.deleteMany({ room_id: { $in: sharedRoomIds } });
  }
}
