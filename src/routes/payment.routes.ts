import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';


const router = Router();


// Route called by website to get Flutterwave payment URL
router.post('/payment/initialize', PaymentController.initializeVoucherPurchase);


// Webhook endpoint registered on Flutterwave Dashboard
router.post('/payment/flutterwave-webhook', PaymentController.handleFlutterwaveWebhook);


// Route called by frontend after redirect to fetch the generated voucher
router.get('/payment/verify', PaymentController.verifyVoucherQuery);


export default router;
