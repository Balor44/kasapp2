import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getUserState, saveUserState, clearUserState, UserState } from '../services/userState.service';
import { parseWhatsAppMessage } from '../services/aiParser';
import { WhatsAppService } from '../services/whatsapp.service';
import { UserModel } from '../models/User'; // Import your user model
import { ChatbotService } from '../services/chatbot.service'; // Import ChatbotService to execute actions


const router = Router();


const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;


// 1. SIGNATURE VERIFICATION MIDDLEWARE
const verifyMetaSignature = (req: Request, res: Response, buf: Buffer, encoding: string) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.error("Missing signature.");
    throw new Error('No signature provided');
  }


  if (!APP_SECRET) {
    console.error("Missing APP_SECRET in environment variables.");
    throw new Error('Server misconfiguration');
  }


  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', APP_SECRET)
    .update(buf)
    .digest('hex')}`;


  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.error("Signature verification failed.");
    throw new Error('Invalid signature');
  }
};


// 2. GET: META VERIFICATION HANDSHAKE
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


// 3. POST: RECEIVE MESSAGES
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
           
            if (message.type === 'text') {
              const textBody = message.text.body.trim();
              console.log(`Received message from ${senderPhone}: ${textBody}`);
             
              getUserState(senderPhone).then(async (userState) => {
               
                // ==========================================
                // 🔐 PIN VERIFICATION & EXECUTION BLOCK
                // ==========================================
                if (userState.step === 'AWAITING_PIN') {
                   console.log(`User is confirming a tx. Verifying PIN: ${textBody}`);
                   
                   // 1. Fetch user to get hashed PIN
                   const user = await UserModel.findOne({ phone: senderPhone });
                   
                   if (!user || !user.pin) {
                     await clearUserState(senderPhone);
                     await WhatsAppService.sendMessage(senderPhone, "⚠️ *Security PIN Required*\n\nYou must set a security PIN before transacting. Type: */setpin [4-6 digits]* to set your PIN first.");
                     return;
                   }


                   // 2. Verify the PIN using bcrypt (same as your seed export logic)
                   const isMatch = await bcrypt.compare(textBody, user.pin);
                   
                   if (!isMatch) {
                     await clearUserState(senderPhone);
                     await WhatsAppService.sendMessage(senderPhone, '❌ *Incorrect Security PIN.*\n\nTransaction cancelled for your protection.');
                     return;
                   }


                   // 3. PIN IS CORRECT! Execute the transaction via ChatbotService
                   await WhatsAppService.sendMessage(senderPhone, '🔄 Processing your transaction...');
                   
                   let resultMessage = '';
                   if (userState.intent === 'SEND_KAS') {
                       // Map state data back to ChatbotService command
                       const command = `/send ${userState.recipient} ${userState.amount}`;
                       resultMessage = await ChatbotService.processIncomingMessage(senderPhone, command);
                   } else if (userState.intent === 'BUY_AIRTIME') {
                       const command = `/airtime ${userState.provider} ${senderPhone} ${userState.amount}`;
                       resultMessage = await ChatbotService.processIncomingMessage(senderPhone, command);
                   }
                   
                   // Clear state after execution and send the result
                   await clearUserState(senderPhone);
                   await WhatsAppService.sendMessage(senderPhone, resultMessage);
                }
                
                // ==========================================
                // 📍 RECIPIENT COLLECTION BLOCK
                // ==========================================
                else if (userState.step === 'AWAITING_RECIPIENT') {
                   console.log(`User provided recipient: ${textBody}`);
                   
                   await saveUserState(senderPhone, {
                     ...userState,
                     step: 'AWAITING_PIN',
                     recipient: textBody
                   });
                   await WhatsAppService.sendMessage(senderPhone, `Great. Please reply with your PIN to confirm sending ${userState.amount} KAS to ${textBody}.`);
                }
                
                // ==========================================
                // 🧠 AI INTENT PARSER BLOCK (IDLE STATE)
                // ==========================================
                else {
                   console.log(`New request. Sending to AI Intent Parser: ${textBody}`);
                   
                   const parsed = await parseWhatsAppMessage(textBody);
                   console.log('AI Parsed Intent:', parsed);


                   if (parsed.intent === 'SEND_KAS') {
                      if (!parsed.recipient || parsed.recipient === '+' || parsed.recipient.trim() === '') {
                         await saveUserState(senderPhone, {
                           step: 'AWAITING_RECIPIENT',
                           intent: 'SEND_KAS',
                           amount: parsed.amount
                         });
                         await WhatsAppService.sendMessage(senderPhone, `Got it. You want to send ${parsed.amount || ''} KAS. Please reply with the recipient's Kaspa address or phone number:`);
                         return;
                      }


                      await saveUserState(senderPhone, {
                           step: 'AWAITING_PIN',
                           intent: 'SEND_KAS',
                           amount: parsed.amount,
                           recipient: parsed.recipient
                      });
                      await WhatsAppService.sendMessage(senderPhone, `Sending ${parsed.amount} KAS to ${parsed.recipient}. Please reply with your PIN to confirm:`);
                   } 
                   else if (parsed.intent === 'BUY_AIRTIME') {
                      await saveUserState(senderPhone, {
                        step: 'AWAITING_PIN',
                        intent: 'BUY_AIRTIME',
                        amount: parsed.amount,
                        provider: parsed.provider
                      });
                      await WhatsAppService.sendMessage(senderPhone, `You want to buy ${parsed.amount} NGN airtime. Please reply with your PIN to confirm:`);
                   }
                   else {
                      const reply = parsed.conversationalReply || "Welcome to Kasapp! What would you like to do today?";
                      await WhatsAppService.sendMessage(senderPhone, reply);
                   }
                }


              }).catch((err) => {
                console.error('Error handling user state from Redis:', err);
              });
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