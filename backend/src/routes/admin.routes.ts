import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authRequired } from '../middleware/authRequired';
import { roleGuard } from '../middleware/roleGuard';
import {
  stats,
  users,
  getAdminUser,
  verifyProvider,
  rejectProvider,
  verificationFile,
  patchUser,
  removeRequestAsAdmin,
  getTowPricing,
  patchTowPricing,
  listRequests,
  getRequest,
  listVehicles,
  listDiagnoses,
  analytics,
  auditLogs,
  seedDemo,
} from '../controllers/admin.controller';

const router = Router();
const analyticsLimiter = rateLimit({ windowMs: 60_000, max: 40 });

router.use(authRequired, roleGuard(['admin']));
router.get('/stats', stats);
router.get('/users', users);
router.get('/users/:id/verification-file/:field', verificationFile);
router.get('/users/:id', getAdminUser);
router.post('/users/:id/verify-provider', verifyProvider);
router.post('/users/:id/reject-provider', rejectProvider);
router.patch('/users/:id', patchUser);
router.delete('/requests/:id', removeRequestAsAdmin);
router.get('/pricing/tow', getTowPricing);
router.patch('/pricing/tow', patchTowPricing);
router.get('/requests', listRequests);
router.get('/requests/:id', getRequest);
router.get('/vehicles', listVehicles);
router.get('/diagnoses', listDiagnoses);
router.get('/analytics', analyticsLimiter, analytics);
router.get('/audit-logs', auditLogs);
router.post('/seed-demo', seedDemo);

export default router;
