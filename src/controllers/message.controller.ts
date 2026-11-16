import { Request, Response } from 'express';
import { ChatbotService } from '../services/chatbot.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { normalizePhone } from '../utils/phone';


export const handleMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message } = req.body;
    const normalizedPhone = normalizePhone(phone);


    if (!normalizedPhone || !message) {
      res.status(400).json({ error: 'phone and message are required' });
      return;
    }


    const reply = await ChatbotService.processIncomingMessage(normalizedPhone, message);
    res.json({ reply });
  } catch (error: any) {
    console.error('[handleMessage Error]:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};


export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  // 1. Immediately acknowledge Meta to prevent webhook retries
  res.sendStatus(200);


  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;


    const rawPhone = message.from;
    const phone = normalizePhone(rawPhone);


    // Default to empty string if message type is not text
    const text = message.text?.body || '';


    if (!text.trim()) return;


    console.log(`[WhatsApp Webhook] From: ${phone} | Text: "${text}"`);


    // 2. Process message through ChatbotService engine
    const reply = await ChatbotService.processIncomingMessage(phone, text);


    // 3. Dispatch outbound reply via WhatsApp API
    await WhatsAppService.sendMessage(phone, reply);
  } catch (error) {
    console.error('[handleWebhook Error]:', error);
  }
};


export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];


  // Check if a request is for verification
  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[KasApp] Meta Webhook verified successfully!');
      // CRITICAL: Send exactly the challenge string back, nothing else.
      return res.status(200).send(challenge);
    } else {
      // Token didn't match
      console.error('[KasApp] Webhook verification failed. Token mismatch.');
      return res.sendStatus(403);
    }
  }
  
  return res.sendStatus(400);
};