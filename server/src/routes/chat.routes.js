import { Router } from 'express';
import {
  createDirectChat,
  createDirectChatSchema,
  chatPreferenceSchema,
  deleteChat,
  hideChatFromFeed,
  deleteMessage,
  editMessage,
  editMessageSchema,
  listCalls,
  listChats,
  listMessages,
  markChatRead,
  messageSchema,
  nicknameSchema,
  reactionSchema,
  reactToMessage,
  sendMessage,
  setChatPinned,
  setChatStarred,
  updateNickname
} from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.get('/', listChats);
router.post('/', validate(createDirectChatSchema), createDirectChat);
router.get('/:chatId/messages', listMessages);
router.get('/:chatId/calls', listCalls);
router.post('/:chatId/messages', validate(messageSchema), sendMessage);
router.patch('/:chatId/messages/:messageId', validate(editMessageSchema), editMessage);
router.post('/:chatId/messages/:messageId/reactions', validate(reactionSchema), reactToMessage);
router.patch('/:chatId/read', markChatRead);
router.patch('/:chatId/nicknames', validate(nicknameSchema), updateNickname);
router.patch('/:chatId/hide', hideChatFromFeed);
router.patch('/:chatId/pin', validate(chatPreferenceSchema), setChatPinned);
router.patch('/:chatId/star', validate(chatPreferenceSchema), setChatStarred);
router.delete('/:chatId/messages/:messageId', deleteMessage);
router.delete('/:chatId', deleteChat);

export default router;
