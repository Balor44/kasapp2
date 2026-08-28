// src/routes/payment.routes.ts
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';


const router = Router();


// Route called by website to initialize Paystack payment
router.post('/payment/initialize', PaymentController.initializeVoucherPurchase);


// Route called by frontend after redirect to fetch the generated voucher details
router.get('/payment/verify', PaymentController.verifyVoucherQuery);


// Webhook endpoint registered on Paystack Dashboard
router.post('/webhooks/paystack', PaymentController.handlePaystackWebhook);


export default router;