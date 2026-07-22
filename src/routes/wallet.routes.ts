import { Router } from 'express';
import { createWallet, getBalance, sendMoney } from '../controllers/wallet.controller';

const router = Router();
router.post('/create-wallet', createWallet);
router.get('/balance/:phone', getBalance);
router.post('/send', sendMoney);
export default router;