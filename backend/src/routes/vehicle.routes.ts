import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { list, create, update, remove } from '../controllers/vehicle.controller';
import { vehicleRecords } from '../controllers/records.controller';

const router = Router();
router.use(authRequired);
router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);
router.get('/:id/records', vehicleRecords);
export default router;
