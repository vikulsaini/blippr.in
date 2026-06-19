import Joi from 'joi';
import { Router } from 'express';
import { cancelSentFriendRequest, friendRequestSchema, listFriendRequests, listSentFriendRequests, respondFriendRequest, sendFriendRequest, unfriend } from '../controllers/friend.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.get('/requests', listFriendRequests);
router.get('/requests/sent', listSentFriendRequests);
router.delete('/requests/sent/:userId', cancelSentFriendRequest);
router.delete('/:userId', unfriend);
router.post('/requests', validate(friendRequestSchema), sendFriendRequest);

router.patch('/requests/:id', validate(Joi.object({ status: Joi.string().valid('accepted', 'rejected').required() })), respondFriendRequest);

export default router;
