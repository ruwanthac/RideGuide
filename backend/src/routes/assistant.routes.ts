import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { assistantReply } from '../controllers/assistant.controller';
import { listSessions, getSession } from '../controllers/assistant-chat-history.controller';
import { list as listAiCalls, getOne as getAiCall } from '../controllers/ai-call-history.controller';

const router = Router();
router.use(authRequired);
router.post('/assistant', assistantReply);
router.get('/assistant/sessions', listSessions);
router.get('/assistant/sessions/:id', getSession);
router.get('/ai-call-history', listAiCalls);
router.get('/ai-call-history/:id', getAiCall);
export default router;
