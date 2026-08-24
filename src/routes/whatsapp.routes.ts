import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getUserState, saveUserState, clearUserState } from '../services/userState.service';
import { parseWhatsAppMessage } from '../services/aiParser';
import { WhatsAppService } from '../services/whatsapp.service';
import { UserModel } from '../models/User';
import { ChatbotService } from '../services/chatbot.service';
import { KaspaService } from '../wallet/kaspa.service'; // Kept your updated import path


const router = Router();


const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;


// =========================================================================
// 1. SIGNATURE VERIFICATION MIDDLEWARE
// =========================================================================
const verifyMetaSignature = (req: Request, res: Response, buf: Buffer, encoding: string) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    throw new Error('No signature provided');
  }


  if (!APP_SECRET) {
    throw new Error('Server misconfiguration: Missing APP_SECRET');
  }


  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', APP_SECRET)
    .update(buf)
    .digest('hex')}`;


  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);


  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    console.error(`[WEBHOOK_REJECTED] Signature mismatch.`);
    console.error(`Received: ${signature}`);
    console.error(`Expected: ${expectedSignature}`);
    throw new Error('Invalid signature');
  }
};


// =========================================================================
// 2. META VERIFICATION ENDPOINT (GET)
// =========================================================================
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];


  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WEBHOOK_VERIFIED] Handshake successful');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});


// =========================================================================
// 3. META EVENT RECEIVER (POST)
// =========================================================================
router.post(
  '/webhook',
  express.raw({ type: 'application/json', verify: verifyMetaSignature }),
  async (req: Request, res: Response) => {
    // Acknowledge receipt to Meta immediately (prevents duplicate webhook retries)
    res.sendStatus(200);


    try {
      const body = JSON.parse(req.body.toString());


      if (body.object !== 'whatsapp_business_account') return;


      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value?.messages || value.messages.length === 0) continue;


          const message = value.messages[0];
          const senderPhone = message.from;


          // -----------------------------------------------------------------
          // 🔘 INTERACTIVE BUTTON CLICK HANDLER
          // -----------------------------------------------------------------
          if (message.type === 'interactive') {
            const buttonId = message.interactive.button_reply?.id;
            console.log(`[Button Clicked] ${senderPhone} selected: ${buttonId}`);


            let command = '';
            if (buttonId === 'menu_wallet') command = '/balance';
            if (buttonId === 'menu_send') command = '/help send';
            if (buttonId === 'menu_bills') command = '/help bills';


            if (command) {
              const resultMsg = await ChatbotService.processIncomingMessage(senderPhone, command);
              await WhatsAppService.sendMessage(senderPhone, resultMsg);
            }
            continue;
          }


          // -----------------------------------------------------------------
          // 💬 TEXT MESSAGE & STATE MACHINE HANDLER
          // -----------------------------------------------------------------
          if (message.type === 'text') {
            const textBody = message.text.body.trim();
            console.log(`[Received Text] ${senderPhone}: "${textBody}"`);


            // ===============================================================
            // MASTER DB LOOKUP & NEW USER ONBOARDING
            // ===============================================================
            let user = await UserModel.findOne({ phone: senderPhone })
                    || await UserModel.findOne({ phone: `+${senderPhone}` })
                    || await UserModel.findOne({ phoneNumber: senderPhone })
                    || await UserModel.findOne({ phoneNumber: `+${senderPhone}` });


            if (!user) {
              console.log(`[Onboarding] Brand new user detected: ${senderPhone}`);
              await WhatsAppService.sendMessage(senderPhone, '🔄 Generating your secure Kaspa wallet on-chain... Please wait.');


              try {
                // 1. Generate encrypted Kaspa Wallet
                const newWallet = await KaspaService.createEncryptedWallet();


                // 2. Save new user to MongoDB (Kept your exact schema mapping)
                user = new UserModel({
                  phone: senderPhone,
                  walletAddress: newWallet.address,
                  mnemonic: newWallet.encryptedSeed,
                  pin: null
                });
                await user.save();


                // 3. Drop them straight into PIN setup
                await saveUserState(senderPhone, { step: 'AWAITING_NEW_PIN' });


                await WhatsAppService.sendMessage(
                  senderPhone,
                  `🎉 *Welcome to Kasapp!*\n\nI just generated a brand new, secure Kaspa wallet connected directly to this phone number.\n\n📍 *Your Address:* \`${newWallet.address}\`\n\nTo lock and secure your funds, please reply with a *new 4 to 6 digit PIN*:`
                );
                continue; // Stop execution here so they provide their PIN on the next message
              } catch (error) {
                console.error('[Onboarding Error]:', error);
                await WhatsAppService.sendMessage(senderPhone, '❌ Failed to generate your wallet. Please try again later.');
                continue;
              }
            }


            // Check active Redis session state
            const userState = (await getUserState(senderPhone)) || {};


            // GLOBAL ESCAPE HATCH: Allow users to cancel any active state
            if (['cancel', 'exit', 'stop', 'quit'].includes(textBody.toLowerCase())) {
              if (userState.step) {
                await clearUserState(senderPhone);
                await WhatsAppService.sendMessage(senderPhone, '🚫 Operation cancelled.');
                continue;
              }
            }


            // ---------------------------------------------------------------
            // STEP A: AWAITING RECIPIENT
            // ---------------------------------------------------------------
            if (userState.step === 'AWAITING_RECIPIENT') {
              const recipient = textBody;


              // --- SURGICAL INJECTION: KNS DOMAIN INTERCEPTOR ---
              if (recipient.toLowerCase().endsWith('.kas')) {
                await WhatsAppService.sendMessage(senderPhone, `🔍 Resolving KNS domain *${recipient}*...`);
                // TODO: Integrate actual KNS API resolution here. For now, it passes through.
              }


              await saveUserState(senderPhone, {
                ...userState,
                step: 'AWAITING_PIN',
                recipient: recipient,
              });


              await WhatsAppService.sendMessage(
                senderPhone,
                `Sending *${userState.amount} KAS* to \`${recipient}\`.\n\nPlease enter your *Transaction PIN* to confirm (or type *cancel* to abort):`
              );
              continue;
            }


            // ---------------------------------------------------------------
            // STEP B: AWAITING NEW PIN (For PIN Setup)
            // ---------------------------------------------------------------
            if (userState.step === 'AWAITING_NEW_PIN') {
              const newPin = textBody;
             
              // Pass silently to backend
              const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/setpin ${newPin}`);
             
              await clearUserState(senderPhone);
              await WhatsAppService.sendMessage(senderPhone, resultMessage);
              continue;
            }


            // ---------------------------------------------------------------
            // STEP C: AWAITING PIN (For Transactions)
            // ---------------------------------------------------------------
            if (userState.step === 'AWAITING_PIN') {
              // We reuse the `user` variable we fetched at the very top of the script!
              if (!user.pin) {
                await clearUserState(senderPhone);
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '⚠️ *Security PIN Required*\n\nYou have not set a transaction PIN. Reply with "Set my PIN" to create one.'
                );
                continue;
              }


              // Verify the hashed PIN
              const isMatch = await bcrypt.compare(textBody, user.pin);
              if (!isMatch) {
                await clearUserState(senderPhone);
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '❌ *Incorrect Security PIN.*\n\nTransaction has been cancelled.'
                );
                continue;
              }


              // Execute Transaction
              await WhatsAppService.sendMessage(senderPhone, '🔄 Processing your transaction...');


              let resultMessage = '';
              
              // --- SURGICAL INJECTION: EXECUTING DATA/ELECTRICITY COMMANDS ---
              if (userState.intent === 'SEND_KAS') {
                resultMessage = await ChatbotService.processIncomingMessage(
                  senderPhone,
                  `/send ${userState.recipient} ${userState.amount}`
                );
              } else if (userState.intent === 'BUY_AIRTIME') {
                resultMessage = await ChatbotService.processIncomingMessage(
                  senderPhone,
                  `/airtime ${userState.provider} ${senderPhone} ${userState.amount}`
                );
              } else if (userState.intent === 'BUY_DATA') {
                resultMessage = await ChatbotService.processIncomingMessage(
                  senderPhone,
                  `/data ${userState.provider} ${senderPhone} ${userState.amount}`
                );
              } else if (userState.intent === 'PAY_ELECTRICITY') {
                resultMessage = await ChatbotService.processIncomingMessage(
                  senderPhone,
                  `/electricity ${userState.provider} ${userState.meterNumber} ${userState.amount}`
                );
              }


              await clearUserState(senderPhone);
              await WhatsAppService.sendMessage(senderPhone, resultMessage);
              continue;
            }


            // ---------------------------------------------------------------
            // STEP D: IDLE STATE -> AI INTENT PARSER
            // ---------------------------------------------------------------
            const parsed = await parseWhatsAppMessage(textBody);
            console.log(`[AI Intent Result]`, parsed);


            // HANDLE PIN INTENT
            if (parsed.intent === 'SET_PIN') {
              if (parsed.pin) {
                // One-shot execution: User said "Set my pin to 1234"
                const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/setpin ${parsed.pin}`);
                await WhatsAppService.sendMessage(senderPhone, resultMessage);
                continue;
              }
             
              // Multi-step: User just said "I want to set a pin"
              await saveUserState(senderPhone, { step: 'AWAITING_NEW_PIN' });
              await WhatsAppService.sendMessage(
                senderPhone,
                `🔐 Let's secure your wallet. Please reply with a new 4 to 6 digit PIN:`
              );
              continue;
            }


            // HANDLE SEND INTENT
            if (parsed.intent === 'SEND_KAS') {
              const amount = parsed.amount;


              if (!amount || isNaN(amount) || amount <= 0) {
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '⚠️ Please specify a valid amount of KAS to send.\nExample: *Send 50 KAS to 08012345678*'
                );
                continue;
              }


              if (!parsed.recipient || parsed.recipient === '+' || parsed.recipient.trim() === '') {
                await saveUserState(senderPhone, {
                  step: 'AWAITING_RECIPIENT',
                  intent: 'SEND_KAS',
                  amount: amount,
                });
                await WhatsAppService.sendMessage(
                  senderPhone,
                  `Got it. You want to send *${amount} KAS*.\n\nPlease reply with the recipient's *Kaspa address* or *Phone number*:`
                );
                continue;
              }


              // Both amount and recipient were provided in one prompt
              await saveUserState(senderPhone, {
                step: 'AWAITING_PIN',
                intent: 'SEND_KAS',
                amount: amount,
                recipient: parsed.recipient,
              });
              await WhatsAppService.sendMessage(
                senderPhone,
                `Sending *${amount} KAS* to \`${parsed.recipient}\`.\n\nPlease reply with your *Transaction PIN* to confirm:`
              );
              continue;
            }


            // HANDLE AIRTIME INTENT
            if (parsed.intent === 'BUY_AIRTIME') {
              const amount = parsed.amount;
              const provider = (parsed.provider || 'MTN').toUpperCase();


              if (!amount || isNaN(amount) || amount <= 0) {
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '⚠️ Please specify a valid amount for airtime.\nExample: *Buy 1000 MTN airtime*'
                );
                continue;
              }


              await saveUserState(senderPhone, {
                step: 'AWAITING_PIN',
                intent: 'BUY_AIRTIME',
                amount: amount,
                provider: provider,
              });
              await WhatsAppService.sendMessage(
                senderPhone,
                `Purchase *₦${amount} ${provider}* airtime for this line.\n\nPlease reply with your *Transaction PIN* to confirm:`
              );
              continue;
            }
            
            // --- SURGICAL INJECTION: DATA AND ELECTRICITY INTENTS ---
            if (parsed.intent === 'BUY_DATA') {
              const amount = parsed.amount;
              const provider = (parsed.provider || 'UNKNOWN').toUpperCase();
              if (!amount || isNaN(amount) || amount <= 0) {
                await WhatsAppService.sendMessage(senderPhone, `⚠️ Please specify a valid amount.\nExample: *Buy 1000 MTN data*`);
                continue;
              }
              await saveUserState(senderPhone, { step: 'AWAITING_PIN', intent: 'BUY_DATA', amount: amount, provider: provider });
              await WhatsAppService.sendMessage(senderPhone, `Purchase *₦${amount} ${provider} data* for this line.\n\nPlease reply with your *Transaction PIN* to confirm:`);
              continue;
            }


            if (parsed.intent === 'PAY_ELECTRICITY') {
              const amount = parsed.amount;
              const provider = (parsed.provider || 'UNKNOWN').toUpperCase();
              
              if (!amount || !parsed.meterNumber) {
                await WhatsAppService.sendMessage(senderPhone, `⚠️ Please specify amount, provider, and meter number.\nExample: *Pay 5000 for IKEDC meter 123456789*`);
                continue;
              }
              await saveUserState(senderPhone, { step: 'AWAITING_PIN', intent: 'PAY_ELECTRICITY', amount: amount, provider: provider, meterNumber: parsed.meterNumber });
              await WhatsAppService.sendMessage(senderPhone, `Pay *₦${amount}* for ${provider} meter \`${parsed.meterNumber}\`.\n\nPlease reply with your *Transaction PIN* to confirm:`);
              continue;
            }
           
            // HANDLE BALANCE INTENT
            if (parsed.intent === 'BALANCE') {
              await WhatsAppService.sendMessage(senderPhone, '🔄 Checking your wallet balance on-chain...');
             
              const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, '/balance');
              await WhatsAppService.sendMessage(senderPhone, resultMessage);
              continue;
            }


            // Small talk / Help fallback with action buttons
            const reply = parsed.conversationalReply || 'Welcome to Kasapp! How can I help you today?';
            await WhatsAppService.sendInteractiveButtons(senderPhone, reply, [
              { id: 'menu_send', title: '💸 Send KAS' },
              { id: 'menu_bills', title: '📱 Pay Bills' },
              { id: 'menu_wallet', title: '🔐 Wallet' },
            ]);
          }
        }
      }
    } catch (error) {
      console.error('[Webhook Processing Error]:', error);
    }
  }
);


export default router;