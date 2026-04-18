import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { register, login, me } from '../controllers/auth.controller';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authRequired, me);
export default router;
