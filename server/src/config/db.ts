import mongoose from 'mongoose';
import { env } from './env.js';

// Setup MongoDB connection function
export const connectDb = async (): Promise<void> => {
  try {
    console.log('[MongoDB] Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI);
    console.log('[MongoDB] Connection established successfully.');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err);
    throw err;
  }
};

// 1. Profile Schema
export interface IProfile {
  _id: string;
  username?: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  age?: number;
  dob?: string;
  gender?: string;
  contact?: string;
  hobbies?: string;
  interests?: string[];
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  created_at: Date;
  updated_at: Date;
}

const ProfileSchema = new mongoose.Schema<IProfile>({
  _id: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  name: { type: String },
  avatar_url: { type: String },
  bio: { type: String },
  age: { type: Number },
  dob: { type: String },
  gender: { type: String },
  contact: { type: String },
  hobbies: { type: String },
  interests: { type: [String], default: [] },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);

// 2. Room Schema
const RoomSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom room ID string
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const Room = mongoose.model('Room', RoomSchema);

// 3. Room Member Schema
const RoomMemberSchema = new mongoose.Schema({
  room_id: { type: String, required: true },
  user_id: { type: String, required: true },
  joined_at: { type: Date, default: Date.now },
});
RoomMemberSchema.index({ room_id: 1, user_id: 1 }, { unique: true });

export const RoomMember = mongoose.model('RoomMember', RoomMemberSchema);

// 4. Message Schema
const MessageSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom message ID string
  room_id: { type: String, required: true },
  sender_id: { type: String, required: true },
  content: { type: String },
  media_url: { type: String },
  media_type: { type: String },
  created_at: { type: Date, default: Date.now },
}, { _id: false });

export const Message = mongoose.model('Message', MessageSchema);

// 5. Friend Request Schema
const FriendRequestSchema = new mongoose.Schema({
  sender_id: { type: String, required: true },
  receiver_id: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected'] },
  created_at: { type: Date, default: Date.now },
});
FriendRequestSchema.index({ sender_id: 1, receiver_id: 1 }, { unique: true });

export const FriendRequest = mongoose.model('FriendRequest', FriendRequestSchema);

// 6. Block Schema
const BlockSchema = new mongoose.Schema({
  blocker_id: { type: String, required: true },
  blocked_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});
BlockSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });

export const Block = mongoose.model('Block', BlockSchema);

// 7. Report Schema
const ReportSchema = new mongoose.Schema({
  reporter_id: { type: String, required: true },
  reported_id: { type: String, required: true },
  reason: { type: String, default: 'unspecified' },
  notes: { type: String, default: '' },
  room_id: { type: String },
  created_at: { type: Date, default: Date.now },
});

export const Report = mongoose.model('Report', ReportSchema);
