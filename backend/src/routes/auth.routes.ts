import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { register, registerProvider, login, me, updatePassword } from '../controllers/auth.controller';
import { providerRegisterUpload } from '../middleware/providerRegisterUpload';

const router = Router();

router.post('/register', register);
router.post('/register-provider', (req, res, next) => {
  providerRegisterUpload(req, res, (err) => {
    if (err) return next(err);
    void registerProvider(req, res, next);
  });
});
router.post('/login', login);
router.get('/me', authRequired, me);
router.post('/change-password', authRequired, updatePassword);
export default router;
