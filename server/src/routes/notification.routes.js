import { Router } from 'express';
import { deleteSubscription, getPublicKey, listNotifications, markNotificationsRead, saveSubscription, subscriptionSchema } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/public-key', getPublicKey);
router.use(requireAuth);
router.get('/', listNotifications);
router.patch('/read', markNotificationsRead);
router.post('/subscriptions', validate(subscriptionSchema), saveSubscription);
router.delete('/subscriptions', validate(subscriptionSchema.fork(['keys'], (schema) => schema.optional())), deleteSubscription);

export default router;
