import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { getUserState, saveUserState, clearUserState, UserState } from '../services/userState.service';


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
// Endpoint: GET /api/whatsapp/webhook
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
// Endpoint: POST /api/whatsapp/webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json', verify: verifyMetaSignature }),
  (req: Request, res: Response) => {
    // Return 200 OK immediately to Meta
    res.sendStatus(200);


    try {
      // Parse the raw buffer into JSON now that verification has passed
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
             
              // 1. Fetch the user's current memory state from Redis
              getUserState(senderPhone).then(async (userState) => {
               
                // 2. Route the message based on their current step
                if (userState.step === 'AWAITING_PIN') {
                   console.log(`User is confirming a tx. Verifying PIN: ${textBody}`);
                   // TODO: verifyPinAndExecute(userState, textBody)...
                }
                else if (userState.step === 'AWAITING_RECIPIENT') {
                   console.log(`User provided recipient: ${textBody}`);
                   // TODO: update state, ask for PIN...
                }
                else {
                   // User is in MAIN_MENU / IDLE. This is a brand new request.
                   console.log(`New request. Sending to AI Intent Parser: ${textBody}`);
                   // TODO: const aiResponse = await parseIntentWithAI(textBody);
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