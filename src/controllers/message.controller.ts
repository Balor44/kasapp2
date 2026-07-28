import { Request, Response } from 'express';
import { ChatbotService } from '../services/chatbot.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { normalizePhone } from '../utils/phone';

export const handleMessage = async (req: Request, res: Response): Promise<void> => {
  const { phone, message } = req.body;
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !message) {
    res.status(400).json({ error: 'phone and message are required' });
    return;
  }
  const reply = await ChatbotService.parse(normalizedPhone, message);
  res.json({ reply });
};

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) { res.sendStatus(200); return; }

  const rawPhone = message.from;
  const phone = normalizePhone(rawPhone);
  const text = message.text?.body || '';
  const reply = await ChatbotService.parse(phone, text);

  await WhatsAppService.sendMessage(rawPhone, reply);
  res.sendStatus(200);
};

export const verifyWebhook = (req: Request, res: Response): void => {
  console.log('mode:', req.query['hub.mode']);
  console.log('token:', req.query['hub.verify_token']);
  console.log('expected:', process.env.WHATSAPP_VERIFY_TOKEN);

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kasapp2-verify-token';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

