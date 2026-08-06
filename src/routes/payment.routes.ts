import { Router } from 'express';
import { initializeVoucherPurchase, handleFlutterwaveWebhook } from '../controllers/payment.controller';


const router = Router();


// Route called by website to get Flutterwave payment URL
router.post('/payment/initialize', initializeVoucherPurchase);


// Webhook endpoint registered on Flutterwave Dashboard
router.post('/payment/flutterwave-webhook', handleFlutterwaveWebhook);


export default router;