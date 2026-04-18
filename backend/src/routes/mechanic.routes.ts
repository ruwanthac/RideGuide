import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { nearby } from '../controllers/mechanic.controller';

const router = Router();
router.use(authRequired);
router.get('/nearby', nearby);
export default router;
