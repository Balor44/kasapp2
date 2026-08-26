import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getUserState, saveUserState, clearUserState } from '../services/userState.service';
import { parseWhatsAppMessage } from '../services/aiParser';
import { WhatsAppService } from '../services/whatsapp.service';
import { UserModel } from '../models/User';
import { ChatbotService } from '../services/chatbot.service';
import { KaspaService } from '../wallet/kaspa.service';
import { KnsService } from '../services/kns.service';
import { ReceiptService } from '../services/receipt.service';
import { VtpassService } from '../services/vtpass.service'; 
import { PriceService } from '../services/price.service'; // Added Real-Time Oracle Import


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
    // Acknowledge receipt to Meta immediately
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
                const newWallet = await KaspaService.createEncryptedWallet();


                user = new UserModel({
                  phone: senderPhone,
                  walletAddress: newWallet.address,
                  mnemonic: newWallet.encryptedSeed,
                  pin: null
                });
                await user.save();


                await saveUserState(senderPhone, { step: 'AWAITING_NEW_PIN' });


                await WhatsAppService.sendMessage(
                  senderPhone,
                  `🎉 *Welcome to Kasapp!*\n\nI just generated a brand new, secure Kaspa wallet connected directly to this phone number.\n\n📍 *Your Address:* \`${newWallet.address}\`\n\nTo lock and secure your funds, please reply with a *new 4 to 6 digit PIN*:`
                );
                continue;
              } catch (error) {
                console.error('[Onboarding Error]:', error);
                await WhatsAppService.sendMessage(senderPhone, '❌ Failed to generate your wallet. Please try again later.');
                continue;
              }
            }


            // Check active Redis session state
            const userState = (await getUserState(senderPhone)) || {};


            // GLOBAL ESCAPE HATCH
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
              let recipient = textBody;


              if (recipient.toLowerCase().endsWith('.kas')) {
                await WhatsAppService.sendMessage(senderPhone, `🔍 Resolving KNS domain *${recipient}*...`);
                
                const resolvedAddress = await KnsService.resolveDomain(recipient);
                
                if (!resolvedAddress) {
                  await WhatsAppService.sendMessage(
                    senderPhone,
                    `❌ Could not resolve *${recipient}*. Please ensure the domain is registered or enter a standard \`kaspa:q...\` address:`
                  );
                  continue;
                }


                await WhatsAppService.sendMessage(
                  senderPhone,
                  `✅ Resolved *${recipient}* to:\n\`${resolvedAddress}\``
                );
                recipient = resolvedAddress;
              }


              // Safely preserve amount and set recipient
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
              const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/setpin ${newPin}`);
              
              await clearUserState(senderPhone);
              await WhatsAppService.sendMessage(senderPhone, resultMessage);
              continue;
            }


            // ---------------------------------------------------------------
            // STEP C: AWAITING PIN (For Transactions)
            // ---------------------------------------------------------------
            if (userState.step === 'AWAITING_PIN') {
              if (!user.pin) {
                await clearUserState(senderPhone);
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '⚠️ *Security PIN Required*\n\nYou have not set a transaction PIN. Reply with "Set my PIN" to create one.'
                );
                continue;
              }


              const isMatch = await bcrypt.compare(textBody, user.pin);
              if (!isMatch) {
                await clearUserState(senderPhone);
                await WhatsAppService.sendMessage(
                  senderPhone,
                  '❌ *Incorrect Security PIN.*\n\nTransaction has been cancelled.'
                );
                continue;
              }


              await WhatsAppService.sendMessage(senderPhone, '🔄 Processing your transaction...');


              // --- EXECUTION: SEND_KAS ---
              if (userState.intent === 'SEND_KAS') {
                const targetRecipient = userState.recipient;
                const targetAmount = userState.amount;


                if (!targetRecipient || !targetAmount) {
                  await clearUserState(senderPhone);
                  await WhatsAppService.sendMessage(senderPhone, `❌ Transaction session expired or missing details. Please start over.`);
                  continue;
                }


                const rawResponse = await ChatbotService.processIncomingMessage(
                  senderPhone,
                  `/send ${targetRecipient} ${targetAmount}`
                );


                if (rawResponse.includes('TXID:') || rawResponse.includes('Successful') || /([a-f0-9]{64})/i.test(rawResponse)) {
                  
                  const txMatch = rawResponse.match(/(?:TXID:\*?\s*|txid:\s*)([a-f0-9]{64})/i) || rawResponse.match(/([a-f0-9]{64})/i);
                  const txId = txMatch ? txMatch[1] : null;


                  const balMatch = rawResponse.match(/(?:balance is \*?|balance:\s*)([0-9.]+)\s*KAS/i);
                  const newBalance = balMatch ? balMatch[1] : null;


                  const beautifulReceipt = ReceiptService.formatSendKasReceipt({
                    amount: targetAmount,
                    recipient: targetRecipient,
                    txId: txId,
                    newBalance: newBalance
                  });


                  await clearUserState(senderPhone);
                  
                  // 1. Send receipt to Sender
                  await WhatsAppService.sendInteractiveButtons(senderPhone, beautifulReceipt, [
                    { id: 'menu_wallet', title: '🔐 Check Balance' },
                    { id: 'menu_send', title: '💸 Send Again' }
                  ]);


                  // 2. Receiver Credit Alert
                  try {
                    const receiver = await UserModel.findOne({ phone: targetRecipient })
                                  || await UserModel.findOne({ walletAddress: targetRecipient })
                                  || await UserModel.findOne({ phone: `+${targetRecipient}` });


                    if (receiver) {
                      const receiverAlert =
                        `🔔 *CREDIT ALERT*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `You just received *${targetAmount} KAS*!\n\n` +
                        `*From:* \`${senderPhone}\`\n` +
                        `*TXID:* \`${txId ? txId.slice(0, 8) + '...' + txId.slice(-8) : 'Confirmed'}\`\n\n` +
                        `_Check your balance to see your updated funds._ 🚀`;
                      
                      await WhatsAppService.sendInteractiveButtons(receiver.phone, receiverAlert, [
                        { id: 'menu_wallet', title: '🔐 Check Balance' }
                      ]);
                    }
                  } catch (alertErr) {
                    console.error('[Credit Alert Error]: Could not notify receiver.', alertErr);
                  }


                  continue;
                } else {
                  await clearUserState(senderPhone);
                  await WhatsAppService.sendMessage(senderPhone, rawResponse || `❌ Transaction failed.`);
                  continue;
                }
              }
              
              // --- EXECUTION: UTILITY BILLS (LIVE VTPASS + LIVE ORACLE) ---
               if (userState.intent && ['BUY_AIRTIME', 'BUY_DATA', 'PAY_ELECTRICITY'].includes(userState.intent as string)) {
                const amountNgn = Number(userState.amount);
                const provider = userState.provider || 'MTN';
                const target = userState.intent === 'PAY_ELECTRICITY' ? userState.meterNumber : senderPhone;
                
                // 1. Fetch Real-Time Kaspa Price!
                await WhatsAppService.sendMessage(senderPhone, '🔄 Fetching real-time Kaspa exchange rates...');
                const liveKasExchangeRate = await PriceService.getKaspaToNairaRate(); 
                
                // Add a small spread (e.g., 2%) to cover VTpass fees and network volatility
                const spreadRate = liveKasExchangeRate * 0.98; 
                const kasCost = +(amountNgn / spreadRate).toFixed(4);


                // 2. Transfer KAS to Kasapp Treasury (Using a placeholder treasury address for now)
                const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS || 'kaspa:qzry9408eewd2w0j5v7p4hxntwudgucx3unv7z3rkhurxnmfhm47j9hwt3gjw';
                
                await WhatsAppService.sendMessage(senderPhone, `📉 Live Rate: 1 KAS = ₦${spreadRate.toFixed(2)}\n🔄 Deducting *${kasCost} KAS* (₦${amountNgn}) for ${provider}...`);
                const paymentResult = await ChatbotService.processIncomingMessage(senderPhone, `/send ${treasuryAddress} ${kasCost}`);


                // Check if user has sufficient funds and the transaction passed
                if (!paymentResult.includes('Successful') && !paymentResult.includes('TXID') && !/([a-f0-9]{64})/i.test(paymentResult)) {
                  await clearUserState(senderPhone);
                  await WhatsAppService.sendMessage(senderPhone, `❌ Insufficient KAS balance. You need ${kasCost} KAS to purchase ₦${amountNgn}.\n\nError: ${paymentResult}`);
                  continue;
                }


                // 3. User successfully paid KAS! Trigger VTpass API
                await WhatsAppService.sendMessage(senderPhone, `✅ KAS payment complete. Fetching utility from ${provider}...`);
                
                let vtpassResult: any = { success: false, message: 'Unknown error' };


                if (userState.intent === 'BUY_AIRTIME' || userState.intent === 'BUY_DATA') {
                  vtpassResult = await VtpassService.buyAirtime(provider, senderPhone, amountNgn);
                } else if (userState.intent === 'PAY_ELECTRICITY') {
                  vtpassResult = await VtpassService.payElectricity(provider, target!, amountNgn, senderPhone);
                }


                // 4. Generate the digital receipt
                if (vtpassResult.success) {
                  const typeMap = { BUY_AIRTIME: 'AIRTIME', BUY_DATA: 'DATA', PAY_ELECTRICITY: 'ELECTRICITY' } as const;


                  const beautifulReceipt = ReceiptService.formatBillReceipt({
                    type: typeMap[userState.intent as keyof typeof typeMap],
                    provider: provider,
                    target: target || 'Unknown Target',
                    amountNgn: amountNgn,
                    reference: vtpassResult.reference,
                    token: vtpassResult.token || null,
                    kasDeducted: kasCost
                  });


                  await clearUserState(senderPhone);
                  
                  await WhatsAppService.sendInteractiveButtons(senderPhone, beautifulReceipt, [
                    { id: 'menu_wallet', title: '🔐 Check Balance' },
                    { id: 'menu_bills', title: '📱 Pay Bills' }
                  ]);
                  continue;
                } else {
                  // VERY IMPORTANT: If VTpass fails, we must notify the user. 
                  // In production, this requires an automated reverse-transfer of KAS.
                  await clearUserState(senderPhone);
                  await WhatsAppService.sendMessage(senderPhone, `❌ Provider Error: ${vtpassResult.message}\n\n⚠️ Your ${kasCost} KAS was deducted. Please contact support to have it refunded manually.`);
                  continue;
                }
              }
            }


            // ---------------------------------------------------------------
            // STEP D: IDLE STATE -> AI INTENT PARSER
            // ---------------------------------------------------------------
            const parsed = await parseWhatsAppMessage(textBody);
            console.log(`[AI Intent Result]`, parsed);


            if (parsed.intent === 'SET_PIN') {
              if (parsed.pin) {
                const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, `/setpin ${parsed.pin}`);
                await WhatsAppService.sendMessage(senderPhone, resultMessage);
                continue;
              }
              
              await saveUserState(senderPhone, { step: 'AWAITING_NEW_PIN' });
              await WhatsAppService.sendMessage(senderPhone, `🔐 Let's secure your wallet. Please reply with a new 4 to 6 digit PIN:`);
              continue;
            }


            if (parsed.intent === 'SEND_KAS') {
              const amount = parsed.amount;


              if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                await WhatsAppService.sendMessage(senderPhone, '⚠️ Please specify a valid amount of KAS to send.\nExample: *Send 50 KAS to 08012345678*');
                continue;
              }


              if (!parsed.recipient || parsed.recipient === '+' || parsed.recipient.trim() === '') {
                await saveUserState(senderPhone, {
                  step: 'AWAITING_RECIPIENT',
                  intent: 'SEND_KAS',
                  amount: amount,
                });
                await WhatsAppService.sendMessage(senderPhone, `Got it. You want to send *${amount} KAS*.\n\nPlease reply with the recipient's *Kaspa address*, *.kas domain*, or *Phone number*:`);
                continue;
              }


              let finalRecipient = parsed.recipient;


              if (finalRecipient.toLowerCase().includes('.kas')) {
                const match = finalRecipient.match(/([a-zA-Z0-9_-]+)\.kas/i);
                const domainString = match ? match[0] : finalRecipient;


                await WhatsAppService.sendMessage(senderPhone, `🔍 Resolving KNS domain *${domainString}*...`);
                const resolved = await KnsService.resolveDomain(finalRecipient);
                
                if (!resolved) {
                  await saveUserState(senderPhone, { step: 'AWAITING_RECIPIENT', intent: 'SEND_KAS', amount: amount });
                  await WhatsAppService.sendMessage(senderPhone, `❌ Could not resolve *${domainString}*. Please reply with a valid Kaspa address or Phone number:`);
                  continue;
                }
                
                await WhatsAppService.sendMessage(senderPhone, `✅ Resolved *${domainString}* to:\n\`${resolved}\``);
                finalRecipient = resolved;
              }


              await saveUserState(senderPhone, {
                step: 'AWAITING_PIN',
                intent: 'SEND_KAS',
                amount: amount,
                recipient: finalRecipient,
              });
              await WhatsAppService.sendMessage(senderPhone, `Sending *${amount} KAS* to \`${finalRecipient}\`.\n\nPlease reply with your *Transaction PIN* to confirm:`);
              continue;
            }


            if (parsed.intent === 'BUY_AIRTIME') {
              const amount = parsed.amount;
              const provider = (parsed.provider || 'MTN').toUpperCase();


              if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                await WhatsAppService.sendMessage(senderPhone, '⚠️ Please specify a valid amount for airtime.\nExample: *Buy 1000 MTN airtime*');
                continue;
              }


              await saveUserState(senderPhone, { step: 'AWAITING_PIN', intent: 'BUY_AIRTIME', amount: amount, provider: provider });
              await WhatsAppService.sendMessage(senderPhone, `Purchase *₦${amount} ${provider}* airtime for this line.\n\nPlease reply with your *Transaction PIN* to confirm:`);
              continue;
            }
            
            if (parsed.intent === 'BUY_DATA') {
              const amount = parsed.amount;
              const provider = (parsed.provider || 'UNKNOWN').toUpperCase();
              
              if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
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
            
            if (parsed.intent === 'BALANCE') {
              await WhatsAppService.sendMessage(senderPhone, '🔄 Checking your wallet balance on-chain...');
              const resultMessage = await ChatbotService.processIncomingMessage(senderPhone, '/balance');
              await WhatsAppService.sendMessage(senderPhone, resultMessage);
              continue;
            }


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