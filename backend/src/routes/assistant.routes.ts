import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { assistantReply } from '../controllers/assistant.controller';

const router = Router();
router.use(authRequired);
router.post('/assistant', assistantReply);
export default router;
