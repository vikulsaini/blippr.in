import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  claimAdmin,
  getStats,
  searchUsers,
  updateUserStatus,
  broadcastMessage,
  getAdminMetrics,
  getDbStats,
  runDbQuery,
  getSlowQueries,
  getFilesList,
  deleteFile,
  getFileStats,
  revokeUserSessions,
  getAuditLogs
} from '../controllers/admin.controller.js';

const router = Router();

// Claim admin role route (requires auth, but not admin status yet)
router.post('/claim', requireAuth, claimAdmin);

// Restrict all other routes to verified admins
router.use(requireAuth, requireAdmin);

router.get('/stats', getStats);
router.get('/users', searchUsers);
router.patch('/users/:id', updateUserStatus);
router.post('/users/:id/revoke', revokeUserSessions);
router.post('/broadcast', broadcastMessage);

// Real-Time Analytics Metrics
router.get('/metrics', getAdminMetrics);

// Database Visualizer
router.get('/db/stats', getDbStats);
router.post('/db/query', runDbQuery);
router.get('/db/slow', getSlowQueries);

// File explorer
router.get('/files', getFilesList);
router.delete('/files/:id', deleteFile);
router.get('/files/stats', getFileStats);

// Audit logs
router.get('/audit-logs', getAuditLogs);

export default router;
