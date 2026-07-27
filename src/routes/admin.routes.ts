import { Router } from 'express';
import { getOperatorBalance } from '../controllers/admin.controller';

const router = Router();
router.get('/operator-balance', getOperatorBalance);
export default router;