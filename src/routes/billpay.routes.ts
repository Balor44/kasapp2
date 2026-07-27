import { Router } from 'express';
import { buyAirtime, payElectricity, payWater, payCable } from '../controllers/billpay.controller';

const router = Router();
router.post('/buy-airtime', buyAirtime);
router.post('/pay-electricity', payElectricity);
router.post('/pay-water', payWater);
router.post('/pay-cable', payCable);
export default router;