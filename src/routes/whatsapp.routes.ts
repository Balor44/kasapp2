import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getUserState, saveUserState, clearUserState } from '../services/userState.service';
import { parseWhatsAppMessage } from '../services/aiParser';
import { WhatsAppService } from '../services/whatsapp.service';
import { UserModel } from '../models/User';
import { ChatbotService } from '../services/chatbot.service';


const router = Router();


const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;


const verifyMetaSignature = (req: Request, res: Response, buf: Buffer, encoding: string) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) throw new Error('No signature provided');
  if (!APP_SECRET) throw new Error('Server misconfiguration');


  const expectedSignature = `sha256=${crypto.createHmac('sha256', APP_SECRET).update(buf).digest('hex')}`;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Invalid signature');
  }
};


router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];


  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});


router.post(
  '/webhook',
  express.raw({ type: 'application/json', verify: verifyMetaSignature }),
  (req: Request, res: Response) => {
    res.sendStatus(200);


    try {
      const body = JSON.parse(req.body.toString());


      if (body.object === 'whatsapp_business_account') {
        body.entry.forEach((entry: any) => {
          const changes = entry.changes[0].value;


          if (changes.messages && changes.messages.length > 0) {
            const message = changes.messages[0];
            const senderPhone = message.from;


            // ==========================================
            // 🔘 INTERACTIVE BUTTON CLICK HANDLER
            // ==========================================
            if (message.type === 'interactive') {
              const buttonId = message.interactive.button_reply?.id;
              console.log(`[Button Clicked] ${senderPhone} selected: ${buttonId}`);


              let command = '';
              if (buttonId === 'menu_wallet') command = '/balance';
              if (buttonId === 'menu_send') command = '/help send';
              if (buttonId === 'menu_bills') command = '/help bills';


              if (command) {
                ChatbotService.processIncomingMessage(senderPhone, command).then(async (resultMsg) => {
                  await WhatsAppService.sendMessage(senderPhone, resultMsg);
                });
              }
              return;
            }


            // ==========================================
            // 💬 TEXT MESSAGE HANDLER
            // ==========================================
            if (message.type === 'text') {
              const textBody = message.text.body.trim();
              console.log(`Received text from ${senderPhone}: ${textBody}`);
             
              getUserState(senderPhone).then(async (userState) => {
               
                // 1. PIN VERIFICATION
                if (userState.step === 'AWAITING_PIN') {
                   const user = await UserModel.findOne({ phone: senderPhone });
                   if (!user || !user.pin) {
                     await clearUserState(senderPhone);
                     await WhatsAppService.sendMessage(senderPhone, "⚠️ *Security PIN Required*\n\nYou must set a PIN before transacting. Type: */setpin [4-6 digits]*");
                     return;
                   }


                   const isMatch = await bcrypt.compare(textBody, user.pin);
                   if (!isMatch) {
                     await clearUserState(senderPhone);
                     await WhatsAppService.sendMessage(senderPhone, '❌ *Incorrect Security PIN.*\n\nTransaction cancelled.');
                     return;
                   }


                   await WhatsAppService.sendMessage(senderPhone, '🔄 Processing your transaction...');
                   let resultMessage = '';
                   if (userState.intent === 'SEND_KAS') {
                       resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/send ${userState.recipient} ${userState.amount}`);
                   } else if (userState.intent === 'BUY_AIRTIME') {
                       resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/airtime ${userState.provider} ${senderPhone} ${userState.amount}`);
                   }
                   
                   await clearUserState(senderPhone);
                   await WhatsAppService.sendMessage(senderPhone, resultMessage);
                }
                
                // 2. MISSING RECIPIENT
                else if (userState.step === 'AWAITING_RECIPIENT') {
                   await saveUserState(senderPhone, { ...userState, step: 'AWAITING_PIN', recipient: textBody });
                   await WhatsAppService.sendMessage(senderPhone, `Great. Please reply with your PIN to confirm sending ${userState.amount} KAS to ${textBody}.`);
                }
                
                // 3. AI INTENT PARSER (IDLE STATE)
                else {
                   const parsed = await parseWhatsAppMessage(textBody);
                   console.log('AI Parsed Intent:', parsed);


                   if (parsed.intent === 'SEND_KAS') {
                      if (!parsed.recipient || parsed.recipient === '+' || parsed.recipient.trim() === '') {
                         await saveUserState(senderPhone, { step: 'AWAITING_RECIPIENT', intent: 'SEND_KAS', amount: parsed.amount });
                         await WhatsAppService.sendMessage(senderPhone, `Got it. You want to send ${parsed.amount || ''} KAS. Please reply with the Kaspa address or phone number:`);
                         return;
                      }
                      await saveUserState(senderPhone, { step: 'AWAITING_PIN', intent: 'SEND_KAS', amount: parsed.amount, recipient: parsed.recipient });
                      await WhatsAppService.sendMessage(senderPhone, `Sending ${parsed.amount} KAS to ${parsed.recipient}. Please reply with your PIN to confirm:`);
                   } 
                   else if (parsed.intent === 'BUY_AIRTIME') {
                      await saveUserState(senderPhone, { step: 'AWAITING_PIN', intent: 'BUY_AIRTIME', amount: parsed.amount, provider: parsed.provider });
                      await WhatsAppService.sendMessage(senderPhone, `You want to buy ${parsed.amount} NGN airtime. Please reply with your PIN to confirm:`);
                   }
                   else {
                      // XARA-STYLE BUTTON FALLBACK FOR SMALL TALK/HELP
                      const reply = parsed.conversationalReply || "Welcome to Kasapp! What would you like to do today?";
                      await WhatsAppService.sendInteractiveButtons(
                        senderPhone, 
                        reply, 
                        [
                          { id: 'menu_send', title: '💸 Send KAS' },
                          { id: 'menu_bills', title: '📱 Pay Bills' },
                          { id: 'menu_wallet', title: '🔐 Wallet' }
                        ]
                      );
                   }
                }


              }).catch((err) => console.error('Error handling user state from Redis:', err));
            }
          }
        });
      }
    } catch (error) {
      console.error('Error processing webhook payload:', error);
    }
  }
);


export default router;