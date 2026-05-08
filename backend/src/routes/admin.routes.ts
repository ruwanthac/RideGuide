import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { roleGuard } from '../middleware/roleGuard';
import { stats, users, patchUser, removeRequestAsAdmin, getTowPricing, patchTowPricing } from '../controllers/admin.controller';

const router = Router();
router.use(authRequired, roleGuard(['admin']));
router.get('/stats', stats);
router.get('/users', users);
router.patch('/users/:id', patchUser);
router.delete('/requests/:id', removeRequestAsAdmin);
router.get('/pricing/tow', getTowPricing);
router.patch('/pricing/tow', patchTowPricing);
export default router;
