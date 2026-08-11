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
import { sendWhatsAppNotification } from './whatsapp.service';
import { decryptMnemonic } from '../utils/crypto.utils';
import { VaultService } from '../wallet/vault.service';


export const ChatbotService = {
  /**
   * Primary entry point for messages from WhatsApp.
   * Passes messages directly to the parse engine.
   */
  async processIncomingMessage(fromPhone: string, rawMessageText: string): Promise<string> {
    try {
      return await this.parse(fromPhone, rawMessageText);
    } catch (error) {
      console.error(`[Chatbot Error] Processing message for ${fromPhone}:`, error);
      return "An unexpected error occurred. Type *help* to see what I can do.";
    }
  },


  parse: async (phone: string, message: string): Promise<string> => {
    const rawMsg = message.trim();
    const msg = rawMsg.toLowerCase();
    const senderPhone = normalizePhone(phone); // Standardize sender phone format to E.164 (+234...)


    // -------------------------------------------------------------
    // 0. SELF-HEALING MULTI-FORMAT PHONE LOOKUP
    // -------------------------------------------------------------
    const rawDigits = senderPhone.replace('+', '');
    const localFormat = rawDigits.startsWith('234') ? '0' + rawDigits.slice(3) : rawDigits;
    const internationalFormat = '+' + rawDigits;


    let user = await UserModel.findOne({
      phone: { $in: [phone, senderPhone, rawDigits, localFormat, internationalFormat] }
    });


    // Automatically upgrade legacy formats in database to E.164 standard safely
    if (user && user.phone !== internationalFormat) {
      user.phone = internationalFormat;
      await user.save();
    }


    // -------------------------------------------------------------
    // 1. RECURRING PAYMENTS / AUTO-RENEWAL ROUTER
    // -------------------------------------------------------------
    const userState = await getUserState(senderPhone);


    // Trigger command to enter auto-renewal menu
    if (msg === '/auto' || msg === 'auto' || msg === '/recurring' || msg === 'recurring' || msg === 'subscriptions') {
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
    // 3. NATURAL LANGUAGE / NON-SLASH PATTERN MATCHING & SYNTHESIS
    // -------------------------------------------------------------
   
    // Balance Alias
    if (['balance', 'bal', 'check balance', 'my balance', 'wallet'].includes(msg)) {
      return await ChatbotService.parse(phone, '/balance');
    }


    // Help Alias
    if (['help', 'commands', 'menu'].includes(msg)) {
      return await ChatbotService.parse(phone, '/help');
    }


    // Export Seed Alias
    if (['export', 'export seed', 'backup', 'show seed'].includes(msg)) {
      return await ChatbotService.parse(phone, '/export');
    }


    // Airtime Natural Synthesizer
    const airtimeRegex = /^(?:buy\s+)?airtime\s+(mtn|airtel|glo|9mobile)\s+(\+?\d{10,14})\s+(\d+)$/i;
    const airtimeMatch = rawMsg.match(airtimeRegex);
    if (airtimeMatch) {
      const [, network, targetPhone, amount] = airtimeMatch;
      return await ChatbotService.parse(phone, `/airtime ${network.toUpperCase()} ${targetPhone} ${amount}`);
    }


    // Data Natural Synthesizer
    const dataRegex = /^(?:buy\s+)?data\s+(mtn|airtel|glo|9mobile)\s+(\+?\d{10,14})\s+(\d+)$/i;
    const dataMatch = rawMsg.match(dataRegex);
    if (dataMatch) {
      const [, network, targetPhone, amount] = dataMatch;
      return await ChatbotService.parse(phone, `/data ${network.toUpperCase()} ${targetPhone} ${amount}`);
    }


    // Airtime-to-KAS Natural Synthesizer
    const airtimeToKasRegex = /^(?:convert\s+)?airtime\s+(?:to\s+kas\s+)?(mtn|airtel|glo|9mobile)\s+(\d+)$/i;
    const airtimeToKasMatch = rawMsg.match(airtimeToKasRegex);
    if (airtimeToKasMatch) {
      const [, network, amount] = airtimeToKasMatch;
      return await ChatbotService.parse(phone, `/convert ${network.toUpperCase()} ${amount}`);
    }


    // Send KAS Natural Synthesizer
    const sendRegex = /^(?:send|transfer)\s+([a-zA-Z0-9:+]+)\s+(\d+(?:\.\d+)?)$/i;
    const sendMatch = rawMsg.match(sendRegex);
    if (sendMatch) {
      const [, recipient, amount] = sendMatch;
      return await ChatbotService.parse(phone, `/send ${recipient} ${amount}`);
    }


    // Alternative Send Synthesizer
    const sendAltRegex = /^(?:send|transfer)\s+(\d+(?:\.\d+)?)\s*(?:kas)?\s*(?:to)?\s*([a-zA-Z0-9:+]+)$/i;
    const sendAltMatch = rawMsg.match(sendAltRegex);
    if (sendAltMatch) {
      const [, amount, recipient] = sendAltMatch;
      return await ChatbotService.parse(phone, `/send ${recipient} ${amount}`);
    }


    // Create Voucher Natural Synthesizer: "voucher 50" or "create voucher 50"
    const createVoucherRegex = /^(?:create\s+)?voucher\s+(\d+(?:\.\d+)?)$/i;
    const createVoucherMatch = rawMsg.match(createVoucherRegex);
    if (createVoucherMatch) {
      const [, amount] = createVoucherMatch;
      return await ChatbotService.parse(phone, `/voucher ${amount}`);
    }


    // Redeem Voucher Natural Synthesizer: "redeem KASP-1234-5678"
    const redeemRegex = /^(?:redeem|claim)\s+(KASP-[a-zA-Z0-9-]+)$/i;
    const redeemMatch = rawMsg.match(redeemRegex);
    if (redeemMatch) {
      const [, code] = redeemMatch;
      return await ChatbotService.parse(phone, `/redeem ${code}`);
    }


    // Electricity Natural Synthesizer
    const elecRegex = /^(?:pay\s+)?electricity\s+(ikedc|ekedc|aedc|kedco|phed|ibedc|eedc|kaedco|jed|bedc|yedc)\s+(\d+)\s+(\d+)$/i;
    const elecMatch = rawMsg.match(elecRegex);
    if (elecMatch) {
      const [, provider, meter, amount] = elecMatch;
      return await ChatbotService.parse(phone, `/electricity ${provider.toUpperCase()} ${meter} ${amount}`);
    }


    // Cable TV Natural Synthesizer
    const cableRegex = /^(?:pay\s+)?cable\s+(dstv|gotv|startimes|showmax)\s+(\d+)\s+(\d+)$/i;
    const cableMatch = rawMsg.match(cableRegex);
    if (cableMatch) {
      const [, provider, smartcard, amount] = cableMatch;
      return await ChatbotService.parse(phone, `/cable ${provider.toUpperCase()} ${smartcard} ${amount}`);
    }


    // Water Bill Natural Synthesizer
    const waterRegex = /^(?:pay\s+)?water\s+([a-zA-Z]+)\s+(\d+)\s+(\d+)$/i;
    const waterMatch = rawMsg.match(waterRegex);
    if (waterMatch) {
      const [, provider, account, amount] = waterMatch;
      return await ChatbotService.parse(phone, `/water ${provider.toUpperCase()} ${account} ${amount}`);
    }


    // -------------------------------------------------------------
    // 4. STANDARD COMMAND EXECUTORS
    // -------------------------------------------------------------
    if (msg === 'hi' || msg === 'hello' || msg === 'start') {
      if (user) {
        return "Hey, welcome back! 👋\nYou've got " + user.balance.toFixed(4) + ' KAS sitting in your wallet.\n\nType *help* if you need a reminder of what I can do.';
      }
      const { publicKey, secret } = await KaspaService.generateWallet();
      user = await UserModel.create({
        phone: internationalFormat,
        walletAddress: publicKey,
        mnemonic: secret,
        balance: 0,
      });
      return "Welcome to Kasapp! 🎉 I just set up a wallet for you.\n\nYour address:\n" + publicKey + "\n\n⚠️ Your recovery phrase (save this now — I won't show it again):\n" + secret + "\n\nAnyone with this phrase can access your funds, so keep it somewhere private and offline. Whenever you're ready, type *balance* to see your funds or *help* to see what I can do.";
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


    // --- /send [phone_or_address] [amount] ---
    if (msg.startsWith('/send')) {
      const parts = rawMsg.split(' ');
      const targetRecipient = parts[1];
      const amountStr = parts[2];


      if (!targetRecipient || !amountStr) {
        return (
          "Usage: *send [phone_or_address] [amount_kas]*\n\n" +
          "• Global Transfer: `send +12025550123 10`\n" +
          "• Local Transfer: `send 08012345678 10`\n" +
          "• External Wallet: `send kaspa:qq123... 10`"
        );
      }


      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return 'Please enter a valid KAS amount.';
      }


      if (!user) {
        return "You'll need a wallet first — just say Hi and I'll get you set up.";
      }


      if (user.balance < amount) {
        return `Insufficient balance. You have *${user.balance.toFixed(4)} KAS*.`;
      }


      // CASE A: EXTERNAL KASPA ADDRESS
      if (targetRecipient.toLowerCase().startsWith('kaspa:') || targetRecipient.toLowerCase().startsWith('kasptest:')) {
        const txResult = await KaspaService.sendExternalTransaction(user.mnemonic, targetRecipient, amount);


        if (!txResult.success) {
          return `❌ *Transfer Failed:* ${txResult.error}`;
        }


        user.balance -= amount;
        await user.save();


        return (
          `✅ *On-Chain Transfer Successful!*\n\n` +
          `• *Sent:* ${amount} KAS\n` +
          `• *Recipient:* \`${targetRecipient.slice(0, 12)}...${targetRecipient.slice(-6)}\`\n` +
          `• *TXID:* \`${txResult.txId}\`\n\n` +
          `💳 *New Balance:* ${user.balance.toFixed(4)} KAS`
        );
      }


      // CASE B: GLOBAL PHONE TRANSFER
      const normalizedTargetPhone = normalizePhone(targetRecipient);


      if (!normalizedTargetPhone) {
        return "❌ Invalid phone number. Please include the country code for international numbers (e.g. +12025550123).";
      }


      if (normalizedTargetPhone === senderPhone) {
        return "You can't transfer KAS to your own phone number!";
      }


      const sender = await UserModel.findOneAndUpdate(
        { phone: senderPhone, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true }
      );


      if (!sender) {
        return 'Insufficient balance or pending transaction lock.';
      }


      let recipientUser = await UserModel.findOne({ phone: normalizedTargetPhone });
      if (!recipientUser) {
        const { publicKey, secret } = await KaspaService.generateWallet();
        recipientUser = await UserModel.create({
          phone: normalizedTargetPhone,
          walletAddress: publicKey,
          mnemonic: secret,
          balance: amount,
        });
      } else {
        recipientUser.balance += amount;
        await recipientUser.save();
      }


      const recipientNotificationText =
        `🎉 *You received KAS!*\n\n` +
        `• *Amount:* ${amount} KAS\n` +
        `• *From:* ${senderPhone}\n` +
        `• *New Balance:* ${recipientUser.balance.toFixed(4)} KAS\n\n` +
        `Type *balance* to view your total wallet funds or *help* to spend it!`;


      sendWhatsAppNotification(normalizedTargetPhone, recipientNotificationText).catch((err) => {
        console.error('[RECIPIENT_NOTIFICATION_ERROR]', err);
      });


      return (
        `✅ *Transfer Successful!*\n\n` +
        `Sent *${amount} KAS* to *${normalizedTargetPhone}*.\n` +
        `Your new balance is *${sender.balance.toFixed(4)} KAS*.`
      );
    }


    // --- /voucher [amount] ---
    if (msg.startsWith('/voucher')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 2) return 'Usage: /voucher [amount]\nExample: /voucher 50';


      const amount = parseFloat(parts[1]);
      if (isNaN(amount) || amount <= 0) return 'Please enter a valid amount.';


      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      if (user.balance < amount) return `❌ Insufficient balance. You have ${user.balance.toFixed(4)} KAS.`;


      // Create the Argent Escrow on the blockchain
      const escrow = await VaultService.createVoucherEscrow(user.mnemonic, amount);
      if (!escrow.success || !escrow.voucherCode || !escrow.vaultAddress || !escrow.txId) {
        return `❌ Escrow creation failed: ${escrow.error}`;
      }


      // Save to your DB using the specific RechargeCard schema
      await RechargeCardModel.create({
        code: escrow.voucherCode,
        amount: amount,
        vaultAddress: escrow.vaultAddress,
        fundingTxId: escrow.txId,
        purchasedByPhone: senderPhone,
        used: false
      } as any); 


      // Deduct internal balance (funds are securely locked on-chain)
      user.balance -= amount;
      await user.save();


      return `✅ *Trustless Recharge Card Created*\n\n` +
             `Code: *${escrow.voucherCode}*\n` +
             `Amount: ${amount} KAS\n` +
             `Vault: \`${escrow.vaultAddress}\`\n\n` +
             `Funds are strictly locked on the blockchain until redeemed.`;
    }


    // --- /redeem [code] ---
        if (msg.startsWith('/redeem')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 2) return 'Just need the code!\nUsage: redeem [code]\nExample: `redeem KASP-3D8A-AB8B-846F-2774`';
     
      let currentUser = user;
      if (!currentUser) {
        const { publicKey, secret } = await KaspaService.generateWallet();
        currentUser = await UserModel.create({
          phone: senderPhone,
          walletAddress: publicKey,
          mnemonic: secret,
          balance: 0,
        });
      }


      // Direct raw code extraction with debug logging
      const rawInput = parts[1] || '';
      const code = rawInput.trim().toUpperCase().replace(/[*_~]/g, '');
      console.log(`[DEBUG_REDEEM] Searching database for raw code: "${code}"`);


      const card = await RechargeCardModel.findOne({ code });


      if (!card) {
        return `❌ *Invalid Voucher Code.* Checked for: \`${code}\``;
      }


      if (card.used) {
        return `❌ *Voucher Already Used.*\nThis code was redeemed on ${new Date(card.usedAt!).toLocaleDateString()}.`;
      }


      // Request Argent covenant redemption to unlock UTXO
      const redemption = await VaultService.redeemVoucherEscrow(
        currentUser.walletAddress!, 
        (card as any).vaultAddress,
        code
      );


      if (!redemption.success) {
        return `❌ Blockchain rejected redemption: ${redemption.error}`;
      }


      // Update DB state
      card.used = true;
      card.usedBy = senderPhone;
      card.usedAt = new Date();
      (card as any).redeemTxId = redemption.txId;
      await card.save();


      currentUser.balance += card.amount;
      await currentUser.save();


      return (
        `🎉 *Voucher Successfully Redeemed!*\n\n` +
        `• *Amount Credited:* +${card.amount.toFixed(4)} KAS\n` +
        `• *TXID:* \`${redemption.txId}\`\n\n` +
        `💳 *Your New Balance:* *${currentUser.balance.toFixed(4)} KAS*\n\n` +
        `Type *help* to spend your KAS on airtime, data, or utility bills!`
      );
    }


    // --- /airtime ---
    if (msg.startsWith('/airtime')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: airtime [network] [phone] [amount in naira]\nExample: airtime MTN 08012345678 1000';
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


    // --- /data [network] [phone] [amount_naira] ---
    if (msg.startsWith('/data')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: data [network] [phone] [amount in naira]\nExample: `data MTN 08012345678 1000`';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const network = parts[1].toUpperCase();
      const targetPhone = normalizePhone(parts[2]);
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";


      const requiredKAS = await nairaToKAS(amountNaira);
      if (user.balance < requiredKAS) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';


      const result = await BillPayService.buyData(targetPhone, amountNaira, network);
      if (!result.success) return result.message;


      user.balance -= requiredKAS;
      await user.save();
      return `${result.message}\n💳 *Deducted:* ${requiredKAS.toFixed(4)} KAS`;
    }


    // --- /convert [network] [amount_naira] (Airtime to KAS) ---
    if (msg.startsWith('/convert')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 3) return 'Usage: convert [network] [airtime_naira_amount]\nExample: `convert MTN 1000`';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";


      const network = parts[1].toUpperCase();
      const amountNaira = parseFloat(parts[2]);


      if (isNaN(amountNaira) || amountNaira <= 0) return "Invalid airtime amount.";


      const kasEquivalent = await nairaToKAS(amountNaira * 0.85); // 15% VTU processing fee margin


      return (
        `📱 *Airtime to KAS Swap Request*\n\n` +
        `• *Network:* ${network}\n` +
        `• *Airtime Value:* ₦${amountNaira.toLocaleString()}\n` +
        `• *You Receive:* ~${kasEquivalent.toFixed(4)} KAS (after 15% provider fee)\n\n` +
        `To complete, transfer ₦${amountNaira} airtime to our operational line (*08012345678*), then reply with your transfer reference.`
      );
    }


    // --- /electricity ---
    if (msg.startsWith('/electricity')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: electricity [provider] [meter number] [amount in naira]\nExample: electricity IKEDC 1234567890 5000\nSupported: IKEDC, EKEDC, AEDC, KEDCO, PHED, IBEDC, EEDC, KAEDCO, JED, BEDC, YEDC';
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
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: water [provider] [account number] [amount in naira]\nExample: water LSWC 1234567890 3000';
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
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: cable [provider] [smartcard number] [amount in naira]\nExample: cable DSTV 1234567890 8500\nSupported: DSTV, GOTV, STARTIMES, SHOWMAX';
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
        `• *balance* — Check your live KAS wallet balance`,
        `• */setpin [4-6 digits]* — Set or update security PIN`,
        `• *export* — View recovery phrase (requires PIN)\n`,
        `⚡ *GLOBAL TRANSFERS & TOP-UPS*`,
        `• *send [phone_or_address] [amount]*`,
        `   _Global Phone: send +12025550123 10_`,
        `   _Local Phone: send 08012345678 10_`,
        `   _External Wallet: send kaspa:qq123... 10_`,
        `• *voucher [amount]*`,
        `   _Example: voucher 50_`,
        `• *redeem [code]*`,
        `   _Example: redeem KASP-XXXX-XXXX_`,
        `• *convert [network] [naira]*`,
        `   _Example: convert MTN 1000_\n`,
        `💡 *UTILITY BILLS (1-TAP)*`,
        `• *airtime [network] [phone] [naira]*`,
        `   _Example: airtime MTN 08012345678 1000_`,
        `• *data [network] [phone] [naira]*`,
        `   _Example: data MTN 08012345678 1000_`,
        `• *electricity [provider] [meter] [naira]*`,
        `   _Providers: IKEDC, EKEDC, AEDC, KEDCO, PHED, IBEDC, EEDC, KAEDCO, JED, BEDC, YEDC_`,
        `• *cable [provider] [smartcard] [naira]*`,
        `   _Providers: DSTV, GOTV, STARTIMES, SHOWMAX_`,
        `• *water [provider] [account] [naira]*`,
        `   _Example: water LSWC 1234567890 3000_\n`,
        `🔄 *AUTOMATION & AUTOPILOT*`,
        `• *auto* — Set up & manage recurring bill payments`
      ].join('\n');
    }


    return "Sorry, I didn't quite catch that. Type *help* to see everything I can do.";
  },
};