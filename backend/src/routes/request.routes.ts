import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { list, create, patch, remove, getMessages, towEstimate } from '../controllers/request.controller';

const router = Router();
router.use(authRequired);
router.get('/', list);
router.post('/tow-estimate', towEstimate);
router.post('/', create);
router.patch('/:id', patch);
router.delete('/:id', remove);
router.get('/:id/messages', getMessages);
export default router;
