import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';
import { RechargeCardModel } from '../models/RechargeCard';
import { KaspaService } from '../wallet/kaspa.service';
import { BillPayService } from './billpay.service';
import { nairaToKAS } from '../utils/price';
import { normalizePhone } from '../utils/phone';
import { normalizeVoucherCode } from '../utils/voucherCode';
import { handleRecurringMenu } from '../controllers/subscription.controller';
import { getUserState, saveUserState } from './userState.service';
import { parseWhatsAppMessage, IntentResponse } from './aiParser';
import { sendWhatsAppNotification } from './whatsapp.service';
import { decryptMnemonic } from '../utils/crypto.utils';


export const ChatbotService = {
  /**
   * Primary entry point for natural language messages from WhatsApp.
   * Passes raw text to Gemini AI parser, constructs synthetic commands,
   * and routes them into the existing parse() engine.
   */
  async processIncomingMessage(fromPhone: string, rawMessageText: string): Promise<string> {
    try {
      // 1. Pass natural text through AI Intent Parser
      const parsed: IntentResponse = await parseWhatsAppMessage(rawMessageText);
      console.log(`[Chatbot AI] Parsed intent from "${rawMessageText}":`, parsed);


      // 2. Delegate to corresponding domain handler based on Intent
      switch (parsed.intent) {
        case 'BUY_AIRTIME':
          if (!parsed.recipient || !parsed.amount) {
            return parsed.conversationalReply || "Please specify the network, amount, and phone number.\n\n*Example:* 'Buy 1000 MTN airtime for 08012345678'";
          }
          const provider = parsed.provider || 'MTN';
          return await this.parse(fromPhone, `/airtime ${provider} ${parsed.recipient} ${parsed.amount}`);


        case 'SEND_KAS':
          if (!parsed.recipient || !parsed.amount) {
            return parsed.conversationalReply || "Who would you like to send KAS to?\n\n*Example:* 'Send 10 KAS to 08012345678'";
          }
          return await this.parse(fromPhone, `/send ${parsed.recipient} ${parsed.amount}`);


        case 'BALANCE':
          return await this.parse(fromPhone, '/balance');


        case 'REDEEM_VOUCHER':
          if (!parsed.voucherCode) {
            return parsed.conversationalReply || "Please provide a valid voucher code.\n\n*Example:* 'Redeem KASP-9482-1049'";
          }
          return await this.parse(fromPhone, `/redeem ${parsed.voucherCode}`);


        case 'PAY_ELECTRICITY':
          if (!parsed.recipient || !parsed.amount) {
            return parsed.conversationalReply || "Please specify provider, meter number, and amount.\n\n*Example:* 'Pay 5000 IKEDC electricity for meter 1234567890'";
          }
          const elecProvider = parsed.provider || 'IKEDC';
          return await this.parse(fromPhone, `/electricity ${elecProvider} ${parsed.recipient} ${parsed.amount}`);


        case 'HELP':
          return await this.parse(fromPhone, '/help');


        case 'UNKNOWN':
        default:
          // If message starts with '/', execute directly as slash command
          if (rawMessageText.trim().startsWith('/')) {
            return await this.parse(fromPhone, rawMessageText);
          }
          
          // Use Gemini's friendly conversational reply if available. 
          // If Gemini also failed (UNKNOWN / confidence 0), show the default help text.
          return parsed.conversationalReply || 
            "Welcome to Kasapp! ⚡\n\nYou can chat with me naturally. Try asking:\n• *'Buy 1k MTN airtime for 08012345678'*\n• *'Check my balance'*\n• *'Send 50 KAS to 08012345678'*";
      }
    } catch (error) {
      console.error(`[Chatbot AI Error] Processing message for ${fromPhone}:`, error);
      // Fallback to direct execution if AI service fails entirely
      return await this.parse(fromPhone, rawMessageText);
    }
  },


  parse: async (phone: string, message: string): Promise<string> => {
    const rawMsg = message.trim();
    const msg = rawMsg.toLowerCase();
    const senderPhone = normalizePhone(phone); // Standardize sender phone format
    const user = await UserModel.findOne({ phone: senderPhone });


    // -------------------------------------------------------------
    // 1. RECURRING PAYMENTS / AUTO-RENEWAL ROUTER
    // -------------------------------------------------------------
    const userState = await getUserState(senderPhone);


    // Trigger command to enter auto-renewal menu
    if (msg === '/auto' || msg === '/recurring' || msg === '/subscriptions') {
      userState.step = 'SUB_MENU';
      await saveUserState(senderPhone, userState);
    }


    // Check if user is inside a stateful flow (Subscriptions or PIN verification)
    const isSubStep = userState.step && (
      userState.step.startsWith('SUB_') ||
      userState.step.startsWith('SELECT_') ||
      userState.step.startsWith('INPUT_') ||
      userState.step.startsWith('CONFIRM_')
    );


    if (isSubStep) {
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const reply = await handleRecurringMenu(senderPhone, rawMsg, userState);
      await saveUserState(senderPhone, userState);
      return reply;
    }


    // -------------------------------------------------------------
    // 2. STATE MACHINE HANDLER: PIN CHECK FOR SEED EXPORT
    // -------------------------------------------------------------
    if (userState.step === 'AWAITING_EXPORT_PIN') {
      if (!user || !user.pin) {
        userState.step = '';
        await saveUserState(senderPhone, userState);
        return 'Session expired or security PIN not set.';
      }


      const isMatch = await bcrypt.compare(rawMsg, user.pin);
     
      if (!isMatch) {
        userState.step = '';
        await saveUserState(senderPhone, userState);
        return '❌ *Incorrect Security PIN.*\n\nExport request cancelled for your protection.';
      }


      try {
        const rawMnemonic = decryptMnemonic(user.mnemonic, process.env.ENCRYPTION_KEY || '');
       
        userState.step = '';
        await saveUserState(senderPhone, userState);


        return [
          `🔑 *SECRET RECOVERY PHRASE* 🔑\n`,
          `\`\`\``,
          `${rawMnemonic}`,
          `\`\`\`\n`,
          `⚠️ *CRITICAL SECURITY NOTICE:*`,
          `• Never share these words with anyone.`,
          `• Anyone with this phrase controls your entire KAS balance.`,
          `• Write it down on paper and delete this chat message!`
        ].join('\n');
      } catch (err: any) {
        console.error('[DECRYPT_ERROR]', err.message);
        userState.step = '';
        await saveUserState(senderPhone, userState);
        return '❌ *Decryption Failed:* System encryption key missing or corrupted key format.';
      }
    }


    // -------------------------------------------------------------
    // 3. STANDARD COMMANDS
    // -------------------------------------------------------------
    if (msg === 'hi' || msg === 'hello' || msg === 'start') {
      if (user) {
        return "Hey, welcome back! 👋\nYou've got " + user.balance.toFixed(4) + ' KAS sitting in your wallet.\n\nType /help if you need a reminder of what I can do.';
      }
      const { publicKey, secret } = await KaspaService.generateWallet();
      await UserModel.create({
        phone: senderPhone,
        walletAddress: publicKey,
        mnemonic: secret,
        balance: 0,
      });
      return "Welcome to Kasapp! 🎉 I just set up a wallet for you.\n\nYour address:\n" + publicKey + "\n\n⚠️ Your recovery phrase (save this now — I won't show it again):\n" + secret + "\n\nAnyone with this phrase can access your funds, so keep it somewhere private and offline. Whenever you're ready, type /balance to see your funds or /help to see what I can do.";
    }


    if (msg === '/balance') {
      if (!user) return "Looks like you don't have a wallet yet — just say Hi and I'll set one up for you.";
      return "Here's where you stand:\n" + user.balance.toFixed(4) + ' KAS';
    }


    // --- /setpin [4-6 digits] OR /setpin [old_pin] [new_pin] ---
    if (msg.startsWith('/setpin')) {
      const parts = rawMsg.split(' ');


      if (!user) {
        return "You'll need a wallet first — just say Hi and I'll get you set up.";
      }


      // CASE 1: User ALREADY HAS a PIN
      if (user.pin) {
        const oldPinInput = parts[1];
        const newPinInput = parts[2];


        if (!oldPinInput || !newPinInput || !/^\d{4,6}$/.test(oldPinInput) || !/^\d{4,6}$/.test(newPinInput)) {
          return (
            '🔒 *Update Security PIN*\n\n' +
            'Since you already have a PIN set, you must provide your current PIN first.\n\n' +
            'Usage: */setpin [old_pin] [new_pin]*\n' +
            'Example: */setpin 1234 9999*'
          );
        }


        const isOldPinCorrect = await bcrypt.compare(oldPinInput, user.pin);
        if (!isOldPinCorrect) {
          return '❌ *Incorrect Current PIN.*\n\nPIN update rejected for your protection.';
        }


        const salt = await bcrypt.genSalt(10);
        const hashedNewPin = await bcrypt.hash(newPinInput, salt);


        await UserModel.updateOne({ phone: senderPhone }, { pin: hashedNewPin });
        return '🔒 *Security PIN Updated Successfully!*';
      }


      // CASE 2: FIRST-TIME PIN CREATION
      const pinInput = parts[1];


      if (!pinInput || !/^\d{4,6}$/.test(pinInput)) {
        return '❌ *Invalid PIN Format*\n\nPIN must be 4 to 6 digits.\nExample: */setpin 4921*';
      }


      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pinInput, salt);


      await UserModel.updateOne({ phone: senderPhone }, { pin: hashedPin });
      return '🔒 *Security PIN Saved!*\n\nYour PIN is now active and required when revealing your recovery phrase.';
    }


    // --- /export ---
    if (msg === '/export') {
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      if (!user.pin) {
        return '⚠️ *Security PIN Required*\n\nYou must set a security PIN before viewing your secret recovery phrase.\n\nType: */setpin [4-6 digits]* to set your PIN first.';
      }


      userState.step = 'AWAITING_EXPORT_PIN';
      await saveUserState(senderPhone, userState);
      return '🔒 *Security Check*\n\nPlease reply with your 4-6 digit Security PIN to reveal your recovery phrase:';
    }


    // --- /send [phone] [amount] ---
    if (msg.startsWith('/send')) {
      const parts = rawMsg.split(' ');
      const targetPhoneInput = parts[1];
      const amountStr = parts[2];


      if (!targetPhoneInput || !amountStr) {
        return 'Usage: /send [phone_number] [amount_kas]\nExample: /send 08123456789 10';
      }


      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return 'Please enter a valid KAS amount.';
      }


      const normalizedTargetPhone = normalizePhone(targetPhoneInput);


      if (normalizedTargetPhone === senderPhone) {
        return "You can't transfer KAS to your own number!";
      }


      const sender = await UserModel.findOneAndUpdate(
        { phone: senderPhone, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true }
      );


      if (!sender) {
        return 'Insufficient balance or pending transaction lock.';
      }


      const recipient = await UserModel.findOneAndUpdate(
        { phone: normalizedTargetPhone },
        { $inc: { balance: amount } },
        { upsert: true, new: true }
      );


      const recipientNotificationText =
        `🎉 *You received KAS!*\n\n` +
        `• *Amount:* ${amount} KAS\n` +
        `• *From:* ${senderPhone}\n` +
        `• *New Balance:* ${recipient.balance.toFixed(4)} KAS\n\n` +
        `Type */balance* to view your total wallet funds or */help* to spend it on utility bills!`;


      sendWhatsAppNotification(normalizedTargetPhone, recipientNotificationText).catch((err) => {
        console.error('[RECIPIENT_NOTIFICATION_ERROR]', err);
      });


      return (
        `✅ *Transfer Successful!*\n\n` +
        `Sent *${amount} KAS* to *${normalizedTargetPhone}*.\n` +
        `Your new balance is *${sender.balance.toFixed(4)} KAS*.`
      );
    }


    // --- /redeem [code] ---
    if (msg.startsWith('/redeem')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 2) return 'Just need the code!\nUsage: /redeem [code]';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const code = normalizeVoucherCode(parts[1]);
      const card = await RechargeCardModel.findOne({ code, used: false });


      if (!card) return "That code doesn't look valid, or it's already been used. Double-check it and try again?";


      card.used = true;
      card.usedBy = senderPhone;
      card.usedAt = new Date();
      await card.save();


      user.balance += card.amount;
      await user.save();


      return 'Nice, that worked! 🎉 ' + card.amount + ' KAS just landed in your wallet.';
    }


    // --- /airtime ---
    if (msg.startsWith('/airtime')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: /airtime [network] [phone] [amount in naira]\nExample: /airtime MTN 08012345678 1000';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const network = parts[1].toUpperCase();
      const targetPhone = normalizePhone(parts[2]);
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";


      const requiredKAS = await nairaToKAS(amountNaira);
      if (user.balance < requiredKAS) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';


      const result = await BillPayService.buyAirtime(targetPhone, amountNaira, network);
      if (!result.success) return result.message;


      user.balance -= requiredKAS;
      await user.save();
      return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
    }


    // --- /electricity ---
    if (msg.startsWith('/electricity')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: /electricity [provider] [meter number] [amount in naira]\nExample: /electricity IKEDC 1234567890 5000';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const provider = parts[1].toUpperCase();
      const meterNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";


      const requiredKAS = await nairaToKAS(amountNaira);
      if (user.balance < requiredKAS) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';


      const result = await BillPayService.payElectricity(meterNumber, amountNaira, provider);
      if (!result.success) return result.message;


      user.balance -= requiredKAS;
      await user.save();
      return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
    }


    // --- /water ---
    if (msg.startsWith('/water')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: /water [provider] [account number] [amount in naira]\nExample: /water LSWC 1234567890 3000';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const provider = parts[1].toUpperCase();
      const accountNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";


      const requiredKAS = await nairaToKAS(amountNaira);
      if (user.balance < requiredKAS) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';


      const result = await BillPayService.payWater(accountNumber, amountNaira, provider);
      if (!result.success) return result.message;


      user.balance -= requiredKAS;
      await user.save();
      return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
    }


    // --- /cable ---
    if (msg.startsWith('/cable')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: /cable [provider] [smartcard number] [amount in naira]\nExample: /cable DSTV 1234567890 8500';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const provider = parts[1].toUpperCase();
      const smartcardNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";


      const requiredKAS = await nairaToKAS(amountNaira);
      if (user.balance < requiredKAS) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';


      const result = await BillPayService.payCable(smartcardNumber, amountNaira, provider);
      if (!result.success) return result.message;


      user.balance -= requiredKAS;
      await user.save();
      return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
    }


    // --- /help ---
    if (msg === '/help') {
      return [
        `✨ *Kasapp Command Center* ✨`,
        `Your instant gateway to Kaspa digital payments on WhatsApp!\n`,
        `📱 *WALLET MANAGEMENT*`,
        `• *Hi* — Access your wallet & main options`,
        `• */balance* — Check your live KAS wallet balance`,
        `• */setpin [4-6 digits]* — Set or update security PIN`,
        `• */export* — View recovery phrase (requires PIN)\n`,
        `⚡ *INSTANT TRANSFERS & TOP-UPS*`,
        `• */send [phone] [amount]*`,
        `  _Example: /send 08012345678 10_`,
        `• */redeem [code]*`,
        `  _Example: /redeem MH29-XXXX-XXXX_\n`,
        `💡 *UTILITY BILLS (1-TAP)*`,
        `• */airtime [network] [phone] [naira]*`,
        `  _Example: /airtime MTN 08012345678 1000_`,
        `• */electricity [provider] [meter] [naira]*`,
        `  _Example: /electricity IKEDC 1234567890 5000_`,
        `• */cable [provider] [smartcard] [naira]*`,
        `  _Example: /cable DSTV 1234567890 8500_`,
        `• */water [provider] [account] [naira]*`,
        `  _Example: /water LSWC 1234567890 3000_\n`,
        `🔄 *AUTOMATION & AUTOPILOT*`,
        `• */auto* — Set up & manage recurring bill payments\n`,
        ` Need help? Reply anytime or visit *kasapp.io*`
      ].join('\n');
    }


    return "Sorry, I didn't quite catch that. Type /help to see everything I can do.";
  },
};