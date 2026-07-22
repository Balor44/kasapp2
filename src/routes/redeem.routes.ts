import { Router } from 'express';
import { redeemCard } from '../controllers/redeem.controller';

const router = Router();
router.post('/redeem', redeemCard);
export default router;