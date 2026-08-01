import { Router, Request, Response } from 'express';
import { ChatbotService } from '../services/chatbot.service';


const router = Router();


router.post('/whatsapp/webhook', async (req: Request, res: Response) => {
  try {
    const { from, body } = req.body;


    if (!body) {
      return res.status(400).json({ error: 'Message body is required' });
    }


    // Hand off natural message to ChatbotService (AI Parser + Execution Engine)
    const replyMessage = await ChatbotService.processIncomingMessage(from || '2348000000000', body);


    return res.status(200).json({ 
      status: 'processed', 
      reply: replyMessage 
    });
  } catch (error) {
    console.error('[AI WhatsApp Webhook Error]:', error);
    return res.status(500).json({ error: 'Internal server error processing message' });
  }
});


export default router;