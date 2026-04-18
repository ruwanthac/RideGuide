import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { patchMe } from '../controllers/user.controller';

const router = Router();
router.use(authRequired);
router.patch('/me', patchMe);
export default router;
