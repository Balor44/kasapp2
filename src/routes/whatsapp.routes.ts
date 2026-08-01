import { Router, Request, Response } from 'express';
import { ChatbotService } from '../services/chatbot.service';


const router = Router();


// 1. META WEBHOOK VERIFICATION (GET)
router.get('/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];


  const MY_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kasapp_secret_token';


  if (mode && token === MY_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verified successfully!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});


// 2. INCOMING MESSAGES (POST)
router.post('/whatsapp/webhook', async (req: Request, res: Response) => {
  console.log('[WhatsApp Webhook] Raw Incoming Payload:', JSON.stringify(req.body));
  try {
    const { from, body } = req.body;


    // Handle Meta Cloud API nested payload structure if applicable
    const senderPhone = from || req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    const messageText = body || req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;


    if (!messageText) {
      return res.status(200).json({ status: 'ignored_no_text' });
    }


    const replyMessage = await ChatbotService.processIncomingMessage(senderPhone, messageText);
    return res.status(200).json({ status: 'processed', reply: replyMessage });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;