import { Router } from 'express';
import { handleMessage, handleWebhook, verifyWebhook } from '../controllers/message.controller';

const router = Router();

// 1. Meta / WhatsApp Cloud API Webhook Verification (GET)
router.get('/webhook', verifyWebhook);

// 2. Meta / WhatsApp Cloud API Webhook Event Receiver (POST)
router.post('/webhook', handleWebhook);

// 3. Direct JSON Endpoint for Manual Testing / Postman (POST)
router.post('/message', handleMessage);

export default router;