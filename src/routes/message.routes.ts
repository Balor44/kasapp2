import { Router } from 'express';
import { handleMessage, handleWebhook, verifyWebhook } from '../controllers/message.controller';

const router = Router();
router.post('/message', handleMessage);
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);
export default router;