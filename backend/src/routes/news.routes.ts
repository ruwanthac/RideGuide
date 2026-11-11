import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { getVehicleNews } from '../services/news.service';

const router = Router();
router.use(authRequired);
router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'private, max-age=600');
    res.json(await getVehicleNews());
  } catch (e) {
    next(e);
  }
});
export default router;
