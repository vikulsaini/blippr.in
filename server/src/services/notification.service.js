import webPush from 'web-push';
import NotificationSubscription from '../models/NotificationSubscription.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@varta.local',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function savePushSubscription(user, subscription, userAgent) {
  return NotificationSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user: user._id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent
    },
    { upsert: true, new: true }
  );
}

export async function removePushSubscription(user, endpoint) {
  await NotificationSubscription.deleteOne({ user: user._id, endpoint });
}

export async function notifyUser(userId, payload) {
  if (!vapidPublicKey || !vapidPrivateKey) return { sent: 0, skipped: true };

  const subscriptions = await NotificationSubscription.find({ user: userId });
  const body = JSON.stringify({
    badge: '/favicon.svg',
    icon: '/favicon.svg',
    ...payload
  });

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        body
      )
    )
  );

  const expired = results
    .map((result, index) => ({ result, subscription: subscriptions[index] }))
    .filter(({ result }) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode))
    .map(({ subscription }) => subscription.endpoint);

  if (expired.length) await NotificationSubscription.deleteMany({ endpoint: { $in: expired } });

  return { sent: results.filter((result) => result.status === 'fulfilled').length };
}
