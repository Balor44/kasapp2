"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const kaspa_service_1 = require("../wallet/kaspa.service");
const billpay_service_1 = require("./billpay.service");
const price_1 = require("../utils/price");
const phone_1 = require("../utils/phone");
const voucherCode_1 = require("../utils/voucherCode");
const subscription_controller_1 = require("../controllers/subscription.controller");
const userState_service_1 = require("./userState.service");
const whatsapp_service_1 = require("./whatsapp.service");
const crypto_utils_1 = require("../utils/crypto.utils"); // Ensure correct path for your AES decrypt helper
exports.ChatbotService = {
    parse: async (phone, message) => {
        const rawMsg = message.trim();
        const msg = rawMsg.toLowerCase();
        const senderPhone = (0, phone_1.normalizePhone)(phone); // Standardize sender phone format
        const user = await User_1.UserModel.findOne({ phone: senderPhone });
        // -------------------------------------------------------------
        // 1. RECURRING PAYMENTS / AUTO-RENEWAL ROUTER
        // -------------------------------------------------------------
        const userState = await (0, userState_service_1.getUserState)(senderPhone);
        // Trigger command to enter auto-renewal menu
        if (msg === '/auto' || msg === '/recurring' || msg === '/subscriptions') {
            userState.step = 'SUB_MENU';
            await (0, userState_service_1.saveUserState)(senderPhone, userState);
        }
        // Check if user is inside a stateful flow (Subscriptions or PIN verification)
        const isSubStep = userState.step && (userState.step.startsWith('SUB_') ||
            userState.step.startsWith('SELECT_') ||
            userState.step.startsWith('INPUT_') ||
            userState.step.startsWith('CONFIRM_'));
        if (isSubStep) {
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const reply = await (0, subscription_controller_1.handleRecurringMenu)(senderPhone, rawMsg, userState);
            await (0, userState_service_1.saveUserState)(senderPhone, userState);
            return reply;
        }
        // -------------------------------------------------------------
        // 2. STATE MACHINE HANDLER: PIN CHECK FOR SEED EXPORT
        // -------------------------------------------------------------
        if (userState.step === 'AWAITING_EXPORT_PIN') {
            if (!user || !user.pin) {
                userState.step = '';
                await (0, userState_service_1.saveUserState)(senderPhone, userState);
                return 'Session expired or security PIN not set.';
            }
            const isMatch = await bcrypt_1.default.compare(rawMsg, user.pin);
            if (!isMatch) {
                // Keep state cleared on failure so they have to type /export again
                userState.step = '';
                await (0, userState_service_1.saveUserState)(senderPhone, userState);
                return '❌ *Incorrect Security PIN.*\n\nExport request cancelled for your protection.';
            }
            try {
                const rawMnemonic = (0, crypto_utils_1.decryptMnemonic)(user.mnemonic, process.env.ENCRYPTION_KEY || '');
                // Clear state after successful decryption
                userState.step = '';
                await (0, userState_service_1.saveUserState)(senderPhone, userState);
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
            }
            catch (err) {
                console.error('[DECRYPT_ERROR]', err.message);
                userState.step = '';
                await (0, userState_service_1.saveUserState)(senderPhone, userState);
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
            const { publicKey, secret } = await kaspa_service_1.KaspaService.generateWallet();
            await User_1.UserModel.create({
                phone: senderPhone,
                walletAddress: publicKey,
                mnemonic: secret,
                balance: 0,
            });
            return "Welcome to Kasapp! 🎉 I just set up a wallet for you.\n\nYour address:\n" + publicKey + "\n\n⚠️ Your recovery phrase (save this now — I won't show it again):\n" + secret + "\n\nAnyone with this phrase can access your funds, so keep it somewhere private and offline. Whenever you're ready, type /balance to see your funds or /help to see what I can do.";
        }
        if (msg === '/balance') {
            if (!user)
                return "Looks like you don't have a wallet yet — just say Hi and I'll set one up for you.";
            return "Here's where you stand:\n" + user.balance.toFixed(4) + ' KAS';
        }
        // --- /setpin [4-6 digits] OR /setpin [old_pin] [new_pin] ---
        if (msg.startsWith('/setpin')) {
            const parts = rawMsg.split(' ');
            if (!user) {
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            }
            // CASE 1: User ALREADY HAS a PIN (Requires Old PIN verification)
            if (user.pin) {
                const oldPinInput = parts[1];
                const newPinInput = parts[2];
                if (!oldPinInput || !newPinInput || !/^\d{4,6}$/.test(oldPinInput) || !/^\d{4,6}$/.test(newPinInput)) {
                    return ('🔒 *Update Security PIN*\n\n' +
                        'Since you already have a PIN set, you must provide your current PIN first.\n\n' +
                        'Usage: */setpin [old_pin] [new_pin]*\n' +
                        'Example: */setpin 1234 9999*');
                }
                const isOldPinCorrect = await bcrypt_1.default.compare(oldPinInput, user.pin);
                if (!isOldPinCorrect) {
                    return '❌ *Incorrect Current PIN.*\n\nPIN update rejected for your protection.';
                }
                const salt = await bcrypt_1.default.genSalt(10);
                const hashedNewPin = await bcrypt_1.default.hash(newPinInput, salt);
                await User_1.UserModel.updateOne({ phone: senderPhone }, { pin: hashedNewPin });
                return '🔒 *Security PIN Updated Successfully!*';
            }
            // CASE 2: FIRST-TIME PIN CREATION
            const pinInput = parts[1];
            if (!pinInput || !/^\d{4,6}$/.test(pinInput)) {
                return '❌ *Invalid PIN Format*\n\nPIN must be 4 to 6 digits.\nExample: */setpin 4921*';
            }
            const salt = await bcrypt_1.default.genSalt(10);
            const hashedPin = await bcrypt_1.default.hash(pinInput, salt);
            await User_1.UserModel.updateOne({ phone: senderPhone }, { pin: hashedPin });
            return '🔒 *Security PIN Saved!*\n\nYour PIN is now active and required when revealing your recovery phrase.';
        }
        // --- /export ---
        if (msg === '/export') {
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            if (!user.pin) {
                return '⚠️ *Security PIN Required*\n\nYou must set a security PIN before viewing your secret recovery phrase.\n\nType: */setpin [4-6 digits]* to set your PIN first.';
            }
            userState.step = 'AWAITING_EXPORT_PIN';
            await (0, userState_service_1.saveUserState)(senderPhone, userState);
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
            const normalizedTargetPhone = (0, phone_1.normalizePhone)(targetPhoneInput);
            if (normalizedTargetPhone === senderPhone) {
                return "You can't transfer KAS to your own number!";
            }
            // 1. Atomic Balance Deduction on Sender
            const sender = await User_1.UserModel.findOneAndUpdate({ phone: senderPhone, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
            if (!sender) {
                return 'Insufficient balance or pending transaction lock.';
            }
            // 2. Find or Auto-Provision Recipient & Increment Balance
            const recipient = await User_1.UserModel.findOneAndUpdate({ phone: normalizedTargetPhone }, { $inc: { balance: amount } }, { upsert: true, new: true });
            // 3. 🔔 DISPATCH OUTBOUND NOTIFICATION TO RECIPIENT (Asynchronous)
            const recipientNotificationText = `🎉 *You received KAS!*\n\n` +
                `• *Amount:* ${amount} KAS\n` +
                `• *From:* ${senderPhone}\n` +
                `• *New Balance:* ${recipient.balance.toFixed(4)} KAS\n\n` +
                `Type */balance* to view your total wallet funds or */help* to spend it on utility bills!`;
            (0, whatsapp_service_1.sendWhatsAppNotification)(normalizedTargetPhone, recipientNotificationText).catch((err) => {
                console.error('[RECIPIENT_NOTIFICATION_ERROR]', err);
            });
            // 4. 💬 RETURN RECEIPT TO SENDER (Synchronous Webhook Response)
            return (`✅ *Transfer Successful!*\n\n` +
                `Sent *${amount} KAS* to *${normalizedTargetPhone}*.\n` +
                `Your new balance is *${sender.balance.toFixed(4)} KAS*.`);
        }
        // --- /redeem [code] ---
        if (msg.startsWith('/redeem')) {
            const parts = rawMsg.split(' ');
            if (parts.length < 2)
                return 'Just need the code!\nUsage: /redeem [code]';
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const code = (0, voucherCode_1.normalizeVoucherCode)(parts[1]);
            const card = await RechargeCard_1.RechargeCardModel.findOne({ code, used: false });
            if (!card)
                return "That code doesn't look valid, or it's already been used. Double-check it and try again?";
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
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /airtime [network] [phone] [amount in naira]\nExample: /airtime MTN 08012345678 1000';
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const network = parts[1].toUpperCase();
            const targetPhone = (0, phone_1.normalizePhone)(parts[2]);
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return "That amount doesn't look right — try a positive number.";
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.buyAirtime(targetPhone, amountNaira, network);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        // --- /electricity ---
        if (msg.startsWith('/electricity')) {
            const parts = rawMsg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /electricity [provider] [meter number] [amount in naira]\nExample: /electricity IKEDC 1234567890 5000';
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const provider = parts[1].toUpperCase();
            const meterNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return "That amount doesn't look right — try a positive number.";
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payElectricity(meterNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        // --- /water ---
        if (msg.startsWith('/water')) {
            const parts = rawMsg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /water [provider] [account number] [amount in naira]\nExample: /water LSWC 1234567890 3000';
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const provider = parts[1].toUpperCase();
            const accountNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return "That amount doesn't look right — try a positive number.";
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payWater(accountNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        // --- /cable ---
        if (msg.startsWith('/cable')) {
            const parts = rawMsg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /cable [provider] [smartcard number] [amount in naira]\nExample: /cable DSTV 1234567890 8500';
            if (!user)
                return "You'll need a wallet first — just say Hi and I'll get you set up.";
            const provider = parts[1].toUpperCase();
            const smartcardNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return "That amount doesn't look right — try a positive number.";
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return "You're a little short on balance for that — you'd need " + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payCable(smartcardNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
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
