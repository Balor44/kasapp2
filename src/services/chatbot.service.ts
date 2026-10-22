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
import { getOperatorSeed } from '../utils/operator';
import { kasToSompi, formatKas } from '../utils/sompi';
import { balanceFields, formatBalance, userBalanceSompi } from '../utils/balance';
import { sendFromUser, payBillFromUser, hasOpenOperations } from './payments';
import { redeemOnChain, createVoucher } from './vouchers';
import { provisionUser } from './user.service';


// Settles a utility purchase in real KAS as a chain of logged operations (see services/payments.ts):
// the user's KAS moves to the operator wallet, the bill is paid under a stable provider reference, and
// KAS goes back on chain only if the provider PROVES failure. A timeout is never treated as a failure.
async function settleBillWithKas(
  user: any,
  requiredKAS: number,
  bill: Record<string, any>,
  successMessage: string
): Promise<string> {
  const outcome = await payBillFromUser(user, requiredKAS, bill);
  if (outcome.status === 'DONE') return `${successMessage}\n💳 *Deducted:* ${requiredKAS.toFixed(4)} KAS`;
  if (outcome.status === 'PENDING') {
    return `⏳ *Payment in progress.* We are confirming it with the provider. You will not be charged twice, and if it fails your KAS is returned automatically.`;
  }
  if (outcome.reason === 'INSUFFICIENT') return `You're a little short on balance for that. You'd need ${requiredKAS.toFixed(4)} KAS.`;
  return `❌ *Payment failed.* ${outcome.message || ''}`.trim();
}

export const ChatbotService = {
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
    const senderPhone = normalizePhone(phone);


    const rawDigits = senderPhone.replace('+', '');
    const localFormat = rawDigits.startsWith('234') ? '0' + rawDigits.slice(3) : rawDigits;
    const internationalFormat = '+' + rawDigits;


    let user = await UserModel.findOne({
      phone: { $in: [phone, senderPhone, rawDigits, localFormat, internationalFormat] }
    });


    if (user && user.phone !== internationalFormat) {
      user.phone = internationalFormat;
      await user.save();
    }
    // 🛡️ LEDGER SYNC FIX: Reconcile MongoDB with the Kaspa Mainnet
    // We only sync on financial commands to save RPC calls
    if (user && user.walletAddress) {
      const isFinancialCommand = ['/balance', 'balance', 'bal', '/send', '/voucher', '/airtime', '/data', '/electricity', '/cable', '/water', '/auto'].some(cmd => msg.startsWith(cmd));
      
      if (isFinancialCommand) {
        try {
          // Skip while money is in flight: the chain still shows funds that are already committed.
          if (!(await hasOpenOperations(String(user._id)))) {
            const onChainSompi = await KaspaService.getBalanceSompi(user.walletAddress);
            // If mainnet disagrees with Mongo, mainnet wins
            if (onChainSompi !== userBalanceSompi(user)) {
              Object.assign(user, balanceFields(onChainSompi));
              await UserModel.updateOne({ _id: user._id }, { $set: balanceFields(onChainSompi) });
              console.log(`[Ledger Sync] Updated ${user.phone} balance to ${formatKas(onChainSompi)} KAS`);
            }
          }
        } catch (syncError) {
          console.warn(`[Ledger Sync] Failed to sync ${user.phone} with mainnet. Falling back to DB ledger.`);
        }
      }
    }


    const userState = await getUserState(senderPhone);


    if (msg === '/auto' || msg === 'auto' || msg === '/recurring' || msg === 'recurring' || msg === 'subscriptions') {
      userState.step = 'SUB_MENU';
      await saveUserState(senderPhone, userState);
    }


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


    if (!rawMsg.startsWith('/')) {
      if (['balance', 'bal', 'check balance', 'my balance', 'wallet'].includes(msg)) {
        return await ChatbotService.parse(phone, '/balance');
      }
      if (msg.startsWith('help ') || msg.startsWith('menu ')) {
        const topic = msg.split(' ')[1];
        return await ChatbotService.parse(phone, `/help ${topic}`);
      }
      if (['help', 'commands', 'menu'].includes(msg)) {
        return await ChatbotService.parse(phone, '/help');
      }
      if (['export', 'export seed', 'backup', 'show seed'].includes(msg)) {
        return await ChatbotService.parse(phone, '/export');
      }


      const airtimeRegex = /^(?:buy\s+)?airtime\s+(mtn|airtel|glo|9mobile)\s+(\+?\d{10,14})\s+(\d+)$/i;
      const airtimeMatch = rawMsg.match(airtimeRegex);
      if (airtimeMatch) {
        const [, network, targetPhone, amount] = airtimeMatch;
        return await ChatbotService.parse(phone, `/airtime ${network.toUpperCase()} ${targetPhone} ${amount}`);
      }


      const dataRegex = /^(?:buy\s+)?data\s+(mtn|airtel|glo|9mobile)\s+(\+?\d{10,14})\s+(\d+)$/i;
      const dataMatch = rawMsg.match(dataRegex);
      if (dataMatch) {
        const [, network, targetPhone, amount] = dataMatch;
        return await ChatbotService.parse(phone, `/data ${network.toUpperCase()} ${targetPhone} ${amount}`);
      }


      const airtimeToKasRegex = /^(?:convert\s+)?airtime\s+(?:to\s+kas\s+)?(mtn|airtel|glo|9mobile)\s+(\d+)$/i;
      const airtimeToKasMatch = rawMsg.match(airtimeToKasRegex);
      if (airtimeToKasMatch) {
        const [, network, amount] = airtimeToKasMatch;
        return await ChatbotService.parse(phone, `/convert ${network.toUpperCase()} ${amount}`);
      }


      const sendRegex = /^(?:send|transfer)\s+([a-zA-Z0-9:+]+)\s+(\d+(?:\.\d+)?)$/i;
      const sendMatch = rawMsg.match(sendRegex);
      if (sendMatch) {
        const [, recipient, amount] = sendMatch;
        return await ChatbotService.parse(phone, `/send ${recipient} ${amount}`);
      }


      const sendAltRegex = /^(?:send|transfer)\s+(\d+(?:\.\d+)?)\s*(?:kas)?\s*(?:to)?\s*([a-zA-Z0-9:+]+)$/i;
      const sendAltMatch = rawMsg.match(sendAltRegex);
      if (sendAltMatch) {
        const [, amount, recipient] = sendAltMatch;
        return await ChatbotService.parse(phone, `/send ${recipient} ${amount}`);
      }


      const createVoucherRegex = /^(?:create\s+)?voucher\s+(\d+(?:\.\d+)?)$/i;
      const createVoucherMatch = rawMsg.match(createVoucherRegex);
      if (createVoucherMatch) {
        const [, amount] = createVoucherMatch;
        return await ChatbotService.parse(phone, `/voucher ${amount}`);
      }


      const redeemRegex = /^(?:redeem|claim)\s+.*?(KASP-[a-zA-Z0-9-]+)/i;
      const redeemMatch = rawMsg.match(redeemRegex);
      if (redeemMatch) {
        const [, code] = redeemMatch;
        const cleanCode = code.replace(/[*_~]/g, '');
        return await ChatbotService.parse(phone, `/redeem ${cleanCode}`);
      }


      const elecRegex = /^(?:pay\s+)?electricity\s+(ikedc|ekedc|aedc|kedco|phed|ibedc|eedc|kaedco|jed|bedc|yedc)\s+(\d+)\s+(\d+)$/i;
      const elecMatch = rawMsg.match(elecRegex);
      if (elecMatch) {
        const [, provider, meter, amount] = elecMatch;
        return await ChatbotService.parse(phone, `/electricity ${provider.toUpperCase()} ${meter} ${amount}`);
      }


      const cableRegex = /^(?:pay\s+)?cable\s+(dstv|gotv|startimes|showmax)\s+(\d+)\s+(\d+)$/i;
      const cableMatch = rawMsg.match(cableRegex);
      if (cableMatch) {
        const [, provider, smartcard, amount] = cableMatch;
        return await ChatbotService.parse(phone, `/cable ${provider.toUpperCase()} ${smartcard} ${amount}`);
      }


      const waterRegex = /^(?:pay\s+)?water\s+([a-zA-Z]+)\s+(\d+)\s+(\d+)$/i;
      const waterMatch = rawMsg.match(waterRegex);
      if (waterMatch) {
        const [, provider, account, amount] = waterMatch;
        return await ChatbotService.parse(phone, `/water ${provider.toUpperCase()} ${account} ${amount}`);
      }
    }


    if (msg === 'hi' || msg === 'hello' || msg === 'start') {
      if (user) {
        return "Hey, welcome back! 👋\nYou've got " + formatBalance(user) + ' KAS sitting in your wallet.\n\nType *help* if you need a reminder of what I can do.';
      }
      user = (await provisionUser(internationalFormat)) || (await UserModel.findOne({ phone: internationalFormat }));
      if (!user) return 'Something went wrong setting up your wallet. Please try again.';
      const address = user.walletAddress;
      return "Welcome to Kasapp! 🎉 I just set up a wallet for you.\n\nYour address:\n" + address + "\n\n⚠️ Your wallet is secured using AES encryption. Set a PIN via */setpin* to protect it.";
    }


    if (msg === '/balance') {
      if (!user) return "Looks like you don't have a wallet yet — just say Hi and I'll set one up for you.";
      return "Here's where you stand:\n" + formatBalance(user) + ' KAS';
    }


    if (msg.startsWith('/setpin')) {
      const parts = rawMsg.split(' ');
      if (!user) {
        return "You'll need a wallet first — just say Hi and I'll get you set up.";
      }
      if (user.pin) {
        const oldPinInput = parts[1];
        const newPinInput = parts[2];
        if (!oldPinInput || !newPinInput || !/^\d{4,6}$/.test(oldPinInput) || !/^\d{4,6}$/.test(newPinInput)) {
          return '🔒 *Update Security PIN*\n\nUsage: */setpin [old_pin] [new_pin]*\nExample: */setpin 1234 9999*';
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


      const pinInput = parts[1];
      if (!pinInput || !/^\d{4,6}$/.test(pinInput)) {
        return '❌ *Invalid PIN Format*\n\nPIN must be 4 to 6 digits.\nExample: */setpin 4921*';
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pinInput, salt);
      await UserModel.updateOne({ phone: senderPhone }, { pin: hashedPin });
      return '🔒 *Security PIN Saved!*\n\nYour PIN is now active and required when revealing your recovery phrase.';
    }


    if (msg === '/export') {
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      if (!user.pin) {
        return '⚠️ *Security PIN Required*\n\nYou must set a security PIN before viewing your secret recovery phrase.\n\nType: */setpin [4-6 digits]* to set your PIN first.';
      }
      userState.step = 'AWAITING_EXPORT_PIN';
      await saveUserState(senderPhone, userState);
      return '🔒 *Security Check*\n\nPlease reply with your 4-6 digit Security PIN to reveal your recovery phrase:';
    }


    if (msg.startsWith('/send')) {
      const parts = rawMsg.split(' ');
      const targetRecipient = parts[1];
      const amountStr = parts[2];


      if (!targetRecipient || !amountStr) {
        return "Usage: *send [phone_or_address] [amount_kas]*\n\n• Global Transfer: `send +12025550123 10`\n• Local Transfer: `send 08012345678 10`\n• External Wallet: `send kaspa:qq123... 10`";
      }


      let amountSompi: bigint;
      try { amountSompi = kasToSompi(amountStr); } catch { return 'Please enter a valid KAS amount.'; }
      const amount = Number(amountSompi) / 100000000;
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      if (userBalanceSompi(user) < amountSompi) return `Insufficient balance. You have *${formatBalance(user)} KAS*.`;


      const isChainAddress = targetRecipient.toLowerCase().startsWith('kaspa:') || targetRecipient.toLowerCase().startsWith('kaspatest:');
      let toAddress = targetRecipient;
      let recipientUser: any = null;
      let normalizedTargetPhone = '';

      if (!isChainAddress) {
        normalizedTargetPhone = normalizePhone(targetRecipient);
        if (!normalizedTargetPhone) return "❌ Invalid phone number. Please include the country code for international numbers.";
        if (normalizedTargetPhone === senderPhone) return "You can't transfer KAS to your own phone number!";
        recipientUser = (await UserModel.findOne({ phone: normalizedTargetPhone })) || (await provisionUser(normalizedTargetPhone));
        if (!recipientUser) return '❌ Could not prepare the recipient wallet. Please try again.';
        toAddress = recipientUser.walletAddress!;
      }

      const outcome = await sendFromUser(user, toAddress, formatKas(amountSompi, 8));
      if (outcome.status === 'REJECTED') {
        return outcome.reason === 'INSUFFICIENT'
          ? `Insufficient balance. You have *${formatBalance(await UserModel.findById(user._id) || user)} KAS*.`
          : `❌ *Transfer failed.* Your KAS was not deducted.\n${outcome.message || ''}`.trim();
      }
      if (outcome.status === 'PENDING') {
        return '⏳ *Transfer submitted.* We are confirming it on the network. You will not be charged twice, and if it did not go through your KAS is returned automatically.';
      }

      const txId = outcome.op.txids[outcome.op.txids.length - 1];
      const after = (await UserModel.findById(user._id)) || user;

      if (isChainAddress) {
        return `✅ *On-Chain Transfer Successful!*\n\n• *Sent:* ${formatKas(amountSompi)} KAS\n• *Recipient:* \`${targetRecipient.slice(0, 12)}...${targetRecipient.slice(-6)}\`\n• *TXID:* \`${txId}\`\n\n💳 *New Balance:* ${formatBalance(after)} KAS`;
      }

      // The recipient's wallet now holds the funds on chain. Credit their ledger once for this payout.
      const { ledger } = await import('./ledger.mongo');
      await ledger.credit(String(recipientUser._id), amountSompi, `recv:${outcome.op.key}`);
      const recipientAfter = (await UserModel.findById(recipientUser._id)) || recipientUser;

      const recipientNotificationText = `🎉 *You received KAS!*\n\n• *Amount:* ${formatKas(amountSompi)} KAS\n• *From:* ${senderPhone}\n• *New Balance:* ${formatBalance(recipientAfter)} KAS\n\nType *balance* to view your total wallet funds or *help* to spend it!`;

      try {
        await sendWhatsAppNotification(normalizedTargetPhone, recipientNotificationText);
      } catch (err) {
        console.error('[RECIPIENT_NOTIFICATION_ERROR]', err);
      }

      return `✅ *Transfer Successful!*\n\nSent *${formatKas(amountSompi)} KAS* to *${normalizedTargetPhone}*.\n• *TXID:* \`${txId}\`\nYour new balance is *${formatBalance(after)} KAS*.`;
    }


    if (msg.startsWith('/voucher')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 2) return 'Usage: /voucher [amount]\nExample: /voucher 50';


      let voucherSompi: bigint;
      try { voucherSompi = kasToSompi(parts[1]); } catch { return 'Please enter a valid amount.'; }
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      if (userBalanceSompi(user) < voucherSompi) return `❌ Insufficient balance. You have ${formatBalance(user)} KAS.`;

      const created = await createVoucher(user, formatKas(voucherSompi, 8));
      if (created.status === 'INSUFFICIENT') return `❌ Insufficient balance.`;
      if (created.status === 'FAILED') return `❌ Voucher creation failed. Your KAS was not deducted. ${created.message || ''}`.trim();
      if (created.status === 'PENDING') return '⏳ *Voucher in progress.* We are confirming the funding on the network. Your code will be sent as soon as it is ready, and you will not be charged twice.';

      return `✅ *Recharge Card Created*\n\nCode: *${created.code}*\nAmount: ${formatKas(voucherSompi)} KAS\n\nThe funds are held by KasApp until the card is redeemed.`;
    }


    if (msg.startsWith('/redeem')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 2) return 'Just need the code!\nUsage: redeem [code]\nExample: `redeem KASP-3D8A-AB8B-846F-2774`';
     
      let currentUser = user;
      if (!currentUser) {
        currentUser = (await provisionUser(senderPhone)) || (await UserModel.findOne({ phone: senderPhone }));
        if (!currentUser) return '❌ Could not prepare your wallet. Please try again.';
      }

      const code = normalizeVoucherCode(parts[1]);
      const redeemed = await redeemOnChain(code, currentUser);

      if (redeemed.status === 'INVALID') return "❌ *Invalid or Already Used Voucher Code.* Please check the code and try again.";
      if (redeemed.status === 'FAILED') return `❌ Redemption failed: ${redeemed.message || 'the network did not accept it'}. Your voucher is still valid, please try again.`;
      if (redeemed.status === 'PENDING') return '⏳ *Redemption in progress.* We are confirming it on the network. The funds will arrive in your wallet shortly and the voucher cannot be used twice.';

      const refreshed = (await UserModel.findById(currentUser._id)) || currentUser;
      const finalTxID = redeemed.op!.txids[redeemed.op!.txids.length - 1];
      return (
        `🎉 *Voucher Successfully Redeemed!*\n\n` +
        `• *Amount Credited:* +${formatKas(kasToSompi(redeemed.amount!))} KAS\n` +
        `• *TXID:* \`${finalTxID}\`\n\n` +
        `💳 *Your New Balance:* *${formatBalance(refreshed)} KAS*\n\n` +
        `Type *help bills* to spend your KAS on airtime or utilities!`
      );
    }


    if (msg.startsWith('/airtime')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: airtime [network] [phone] [amount in naira]\nExample: airtime MTN 08012345678 1000';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const network = parts[1].toUpperCase();
      const targetPhone = normalizePhone(parts[2]);
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";
      const requiredKAS = await nairaToKAS(amountNaira);
      if (userBalanceSompi(user) < kasToSompi(requiredKAS)) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
      return await settleBillWithKas(user, requiredKAS, { provider: 'FLUTTERWAVE', kind: 'airtime', target: targetPhone, network: network, amountNaira }, '📱 *Airtime purchase successful!*');
    }


    if (msg.startsWith('/data')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: data [network] [phone] [amount in naira]\nExample: `data MTN 08012345678 1000`';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const network = parts[1].toUpperCase();
      const targetPhone = normalizePhone(parts[2]);
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";
      const requiredKAS = await nairaToKAS(amountNaira);
      if (userBalanceSompi(user) < kasToSompi(requiredKAS)) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
      return await settleBillWithKas(user, requiredKAS, { provider: 'FLUTTERWAVE', kind: 'data', target: targetPhone, network: network, amountNaira }, '📶 *Data purchase successful!*');
    }


    if (msg.startsWith('/convert')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 3) return 'Usage: convert [network] [airtime_naira_amount]\nExample: `convert MTN 1000`';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const network = parts[1].toUpperCase();
      const amountNaira = parseFloat(parts[2]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "Invalid airtime amount.";
      const kasEquivalent = await nairaToKAS(amountNaira * 0.85);
      return `📱 *Airtime to KAS Swap Request*\n\n• *Network:* ${network}\n• *Airtime Value:* ₦${amountNaira.toLocaleString()}\n• *You Receive:* ~${kasEquivalent.toFixed(4)} KAS (after 15% provider fee)\n\nTo complete, transfer ₦${amountNaira} airtime to our operational line (*08012345678*), then reply with your transfer reference.`;
    }


    if (msg.startsWith('/electricity')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: electricity [provider] [meter number] [amount in naira]';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const provider = parts[1].toUpperCase();
      const meterNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";
      const requiredKAS = await nairaToKAS(amountNaira);
      if (userBalanceSompi(user) < kasToSompi(requiredKAS)) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
      return await settleBillWithKas(user, requiredKAS, { provider: 'FLUTTERWAVE', kind: 'electricity', target: meterNumber, network: provider, amountNaira }, '💡 *Electricity payment successful!*');
    }


    if (msg.startsWith('/water')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: water [provider] [account number] [amount in naira]';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const provider = parts[1].toUpperCase();
      const accountNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";
      const requiredKAS = await nairaToKAS(amountNaira);
      if (userBalanceSompi(user) < kasToSompi(requiredKAS)) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
      return await settleBillWithKas(user, requiredKAS, { provider: 'FLUTTERWAVE', kind: 'water', target: accountNumber, network: provider, amountNaira }, '🚰 *Water payment successful!*');
    }


    if (msg.startsWith('/cable')) {
      const parts = rawMsg.split(' ');
      if (parts.length < 4) return 'I need a few more details for that.\nUsage: cable [provider] [smartcard number] [amount in naira]';
      if (!user) return "You'll need a wallet first — just say Hi and I'll get you set up.";
      const provider = parts[1].toUpperCase();
      const smartcardNumber = parts[2];
      const amountNaira = parseFloat(parts[3]);
      if (isNaN(amountNaira) || amountNaira <= 0) return "That amount doesn't look right — try a positive number.";
      const requiredKAS = await nairaToKAS(amountNaira);
      if (userBalanceSompi(user) < kasToSompi(requiredKAS)) return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
      return await settleBillWithKas(user, requiredKAS, { provider: 'FLUTTERWAVE', kind: 'cable', target: smartcardNumber, network: provider, amountNaira }, '📺 *Cable payment successful!*');
    }


    if (msg.startsWith('/help')) {
      const parts = msg.split(' ');
      const topic = parts[1] || 'main';


      if (topic === 'send') {
        return `💸 *How to Send KAS*\n\nTo send Kaspa instantly, type:\n*send [Phone Number or Address] [Amount]*\n\n_Examples:_\n• Phone: \`send 08012345678 150\`\n• Wallet: \`send kaspa:qq123456789... 150\``;
      }
      if (topic === 'bills') {
        return `📱 *How to Pay Bills*\n\n*Airtime:*\n\`airtime [Network] [Number] [Amount Naira]\`\nExample: \`airtime MTN 08012345678 1000\`\n\n*Electricity:*\n\`electricity [Provider] [Meter No] [Amount Naira]\`\nExample: \`electricity IKEDC 1234567890 5000\`\n\n*Cable:*\n\`cable [Provider] [Smartcard] [Amount Naira]\`\nExample: \`cable DSTV 1234567890 8500\``;
      }
      if (topic === 'redeem' || topic === 'voucher') {
        return `🎟️ *Vouchers & Redemption*\n\n*Redeem a voucher:*\n\`redeem [Code]\`\nExample: \`redeem KASP-1234-5678-9012\`\n\n*Create a voucher:*\n\`voucher [Amount KAS]\`\nExample: \`voucher 50\``;
      }
      if (topic === 'wallet') {
        return `🔐 *Wallet Management*\n\n*Check Balance:*\n\`balance\`\n\n*Set Security PIN:*\n\`/setpin [4-6 digits]\`\n\n*Backup Recovery Phrase:*\n\`export\``;
      }
      return `⚡ *Kasapp Main Menu* ⚡\nReply with a keyword to see how it works:\n\n💸 *help send* - Transfer KAS\n🎟️ *help redeem* - Load a voucher\n📱 *help bills* - Airtime, data, TV, electricity\n💰 *help wallet* - Balance, PIN, and backup`;
    }


    return "Sorry, I didn't quite catch that. Type *help* to see everything I can do.";
  },
};


