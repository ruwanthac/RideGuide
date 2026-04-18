import { Router } from 'express';
import { authRequired } from '../middleware/authRequired';
import { run, list } from '../controllers/diagnosis.controller';

const runRouter = Router();
runRouter.use(authRequired);
runRouter.post('/', run);

const historyRouter = Router();
historyRouter.use(authRequired);
historyRouter.get('/', list);

export { runRouter as diagnosisRouter, historyRouter as diagnosisHistoryRouter };
