import { Router } from 'express';
import {
  createDirectChat,
  createDirectChatSchema,
  deleteChat,
  deleteMessage,
  listCalls,
  listChats,
  listMessages,
  markChatRead,
  messageSchema,
  nicknameSchema,
  reactionSchema,
  reactToMessage,
  sendMessage,
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
router.post('/:chatId/messages/:messageId/reactions', validate(reactionSchema), reactToMessage);
router.patch('/:chatId/read', markChatRead);
router.patch('/:chatId/nicknames', validate(nicknameSchema), updateNickname);
router.delete('/:chatId/messages/:messageId', deleteMessage);
router.delete('/:chatId', deleteChat);

export default router;
