import { ObjectId } from 'mongodb';

/**
 * Converts a string ID (if it is a 24-character hex ObjectId string) to an ObjectId object,
 * otherwise returns the value as-is (e.g. UUID string).
 */
export function toDbId(id) {
  if (!id) return id;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    try {
      return new ObjectId(id);
    } catch {
      return id;
    }
  }
  return id;
}

/**
 * Maps a database document's _id to a string representation for id/_id properties.
 */
export function fromDbDoc(doc) {
  if (!doc) return null;
  const res = { ...doc };
  if (doc._id) {
    const strId = doc._id.toString();
    res._id = strId;
    res.id = strId;
  }
  return res;
}

/**
 * Normalizes a Javascript object into a MongoDB database-friendly document:
 * - Strips out function properties and properties starting with '$' or 'id'.
 * - Recursively converts Map instances to plain objects.
 * - Converts 24-character hex strings to ObjectIds on primary _id field.
 */
export function toDbDoc(obj) {
  if (obj === null || obj === undefined) return obj;
  const doc = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || typeof v === 'function' || k === 'id') {
      continue;
    }
    if (k === '_id') {
      doc._id = toDbId(v);
    } else {
      doc[k] = toDbDocNested(v);
    }
  }
  return doc;
}

function toDbDocNested(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val;
  if (val instanceof ObjectId) return val;
  if (val instanceof Map) {
    return toDbDocNested(Object.fromEntries(val));
  }
  if (Array.isArray(val)) {
    return val.map(toDbDocNested);
  }
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v !== 'function') {
        res[k] = toDbDocNested(v);
      }
    }
    return res;
  }
  return val;
}

/**
 * Recursively maps query keys and values to MongoDB-native format:
 * - Map id / _id, chatId, senderId etc., to their database equivalents.
 * - Maps hex string IDs to ObjectId objects.
 */
export function toDbQuery(query) {
  if (!query) return {};
  const dbQuery = {};
  for (const [k, v] of Object.entries(query)) {
    let key = k;
    if (k === 'id' || k === '_id') key = '_id';
    else if (k === 'chatId') key = 'chat_id';
    else if (k === 'chat') key = 'chat_id';
    else if (k === 'senderId') key = 'sender_id';
    else if (k === 'sender') key = 'sender_id';
    else if (k === 'userId') key = 'user_id';
    else if (k === 'user') key = 'user_id';
    else if (k === 'fromId') key = 'from_id';
    else if (k === 'from') key = 'from_id';
    else if (k === 'toId') key = 'to_id';
    else if (k === 'to') key = 'to_id';
    else if (k === 'requestId') key = 'request_id';
    else if (k === 'messageId') key = 'message_id';
    else if (k === 'callId') key = 'call_id';
    else if (k === 'actorId') key = 'actor_id';
    else if (k === 'actor') key = 'actor_id';
    else if (k === 'reporter') key = 'reporter_id';
    else if (k === 'reported') key = 'reported_id';

    dbQuery[key] = mapQueryVal(v);
  }
  return dbQuery;
}

function mapQueryVal(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val;
  if (val instanceof ObjectId) return val;
  if (val instanceof Map) {
    return mapQueryVal(Object.fromEntries(val));
  }
  if (Array.isArray(val)) {
    return val.map(mapQueryVal);
  }
  if (typeof val === 'string') {
    return toDbId(val);
  }
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = mapQueryVal(v);
    }
    return res;
  }
  return val;
}

/**
 * Normalizes MongoDB updates.
 */
export function toDbUpdate(update) {
  if (!update) return {};
  const dbUpdate = {};
  for (const [op, val] of Object.entries(update)) {
    if (op.startsWith('$')) {
      dbUpdate[op] = mapUpdateVal(val);
    } else {
      if (!dbUpdate.$set) dbUpdate.$set = {};
      dbUpdate.$set[op] = mapQueryVal(val);
    }
  }
  return dbUpdate;
}

function mapUpdateVal(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof ObjectId) && !(val instanceof Date)) {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      let key = k;
      if (k === 'seenBy') key = 'seen_by';
      else if (k === 'deletedFor') key = 'deleted_for';
      else if (k === 'chatId') key = 'chat_id';
      else if (k === 'chat') key = 'chat_id';
      else if (k === 'senderId') key = 'sender_id';
      else if (k === 'sender') key = 'sender_id';
      else if (k === 'userId') key = 'user_id';
      else if (k === 'user') key = 'user_id';
      else if (k === 'unreadCounts') key = 'unread_counts';
      else if (k === 'nicknames') key = 'nicknames';
      else if (k === 'hiddenFor') key = 'hidden_for';
      else if (k === 'archivedFor') key = 'archived_for';
      else if (k === 'pinnedFor') key = 'pinned_for';
      else if (k === 'starredFor') key = 'starred_for';
      else if (k === 'mutedFor') key = 'muted_for';
      
      res[key] = mapQueryVal(v);
    }
    return res;
  }
  return mapQueryVal(val);
}

/**
 * Converts sorting values to native MongoDB sort syntax.
 */
export function toDbSort(sort) {
  if (!sort) return { created_at: -1 };
  
  if (typeof sort === 'string') {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    let dbField = field;
    if (field === 'createdAt') dbField = 'created_at';
    else if (field === 'updatedAt') dbField = 'updated_at';
    else if (field === 'lastSeenAt') dbField = 'last_seen_at';
    else if (field === 'startedAt') dbField = 'started_at';
    return { [dbField]: desc ? -1 : 1 };
  }
  
  if (typeof sort === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(sort)) {
      let dbField = k;
      if (k === 'createdAt') dbField = 'created_at';
      else if (k === 'updatedAt') dbField = 'updated_at';
      else if (k === 'lastSeenAt') dbField = 'last_seen_at';
      else if (k === 'startedAt') dbField = 'started_at';
      
      res[dbField] = (v === -1 || String(v).toLowerCase() === 'desc') ? -1 : 1;
    }
    return res;
  }
  
  return { created_at: -1 };
}
