"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const kaspa_service_1 = require("../wallet/kaspa.service");
const billpay_service_1 = require("./billpay.service");
const price_1 = require("../utils/price");
const phone_1 = require("../utils/phone");
const voucherCode_1 = require("../utils/voucherCode");
exports.ChatbotService = {
    parse: async (phone, message) => {
        const msg = message.trim().toLowerCase();
        const user = await User_1.UserModel.findOne({ phone });
        if (msg === 'hi' || msg === 'hello' || msg === 'start') {
            if (user) {
                return 'Hey, welcome back! 👋\nYou\'ve got ' + user.balance.toFixed(4) + ' KAS sitting in your wallet.\n\nType /help if you need a reminder of what I can do.';
            }
            const { publicKey, secret } = await kaspa_service_1.KaspaService.generateWallet();
            await User_1.UserModel.create({
                phone,
                wallet: publicKey,
                mnemonic: secret,
                balance: 0,
            });
            return 'Welcome to Kasapp! 🎉 I just set up a wallet for you.\n\nYour address:\n' + publicKey + '\n\n⚠️ Your recovery phrase (save this now — I won\'t show it again):\n' + secret + '\n\nAnyone with this phrase can access your funds, so keep it somewhere private and offline. Whenever you\'re ready, type /balance to see your funds or /help to see what I can do.';
        }
        if (msg === '/balance') {
            if (!user)
                return 'Looks like you don\'t have a wallet yet — just say Hi and I\'ll set one up for you.';
            return 'Here\'s where you stand:\n' + user.balance.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/send')) {
            const parts = msg.split(' ');
            if (parts.length < 3)
                return 'Almost! I need a bit more info.\nUsage: /send [phone] [amount]\nExample: /send 08012345678 10';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const toPhone = (0, phone_1.normalizePhone)(parts[1]);
            const amount = parseFloat(parts[2]);
            if (isNaN(amount) || amount <= 0)
                return 'That amount doesn\'t look right — try a positive number, like 10.';
            if (user.balance < amount)
                return 'You don\'t have enough KAS for that — you\'ve got ' + user.balance.toFixed(4) + ' KAS.';
            const receiver = await User_1.UserModel.findOne({ phone: toPhone });
            if (!receiver)
                return toPhone + ' isn\'t on Kasapp yet, so I can\'t send them anything just yet. Maybe invite them to join?';
            user.balance -= amount;
            receiver.balance += amount;
            await user.save();
            await receiver.save();
            return 'Done! Sent ' + amount + ' KAS to ' + toPhone + '.\nYour new balance: ' + user.balance.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/redeem')) {
            const parts = msg.split(' ');
            if (parts.length < 2)
                return 'Just need the code!\nUsage: /redeem [code]';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const code = (0, voucherCode_1.normalizeVoucherCode)(parts[1]);
            console.log('[CHATBOT REDEEM DEBUG] raw input:', parts[1], '| normalized code:', code, '| phone:', phone);
            const card = await RechargeCard_1.RechargeCardModel.findOne({ code, used: false });
            console.log('[CHATBOT REDEEM DEBUG] card found:', card);
            if (!card)
                return 'That code doesn\'t look valid, or it\'s already been used. Double-check it and try again?';
            card.used = true;
            card.usedBy = phone;
            card.usedAt = new Date();
            await card.save();
            user.balance += card.amount;
            await user.save();
            return 'Nice, that worked! 🎉 ' + card.amount + ' KAS just landed in your wallet.';
        }
        if (msg.startsWith('/airtime')) {
            const parts = msg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /airtime [network] [phone] [amount in naira]\nExample: /airtime MTN 08012345678 1000';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const network = parts[1].toUpperCase();
            const targetPhone = (0, phone_1.normalizePhone)(parts[2]);
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return 'That amount doesn\'t look right — try a positive number.';
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return 'You\'re a little short on balance for that — you\'d need ' + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.buyAirtime(targetPhone, amountNaira, network);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/electricity')) {
            const parts = msg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /electricity [provider] [meter number] [amount in naira]\nExample: /electricity IKEDC 1234567890 5000';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const provider = parts[1].toUpperCase();
            const meterNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return 'That amount doesn\'t look right — try a positive number.';
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return 'You\'re a little short on balance for that — you\'d need ' + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payElectricity(meterNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/water')) {
            const parts = msg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /water [provider] [account number] [amount in naira]\nExample: /water LSWC 1234567890 3000';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const provider = parts[1].toUpperCase();
            const accountNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return 'That amount doesn\'t look right — try a positive number.';
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return 'You\'re a little short on balance for that — you\'d need ' + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payWater(accountNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/cable')) {
            const parts = msg.split(' ');
            if (parts.length < 4)
                return 'I need a few more details for that.\nUsage: /cable [provider] [smartcard number] [amount in naira]\nExample: /cable DSTV 1234567890 8500';
            if (!user)
                return 'You\'ll need a wallet first — just say Hi and I\'ll get you set up.';
            const provider = parts[1].toUpperCase();
            const smartcardNumber = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return 'That amount doesn\'t look right — try a positive number.';
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return 'You\'re a little short on balance for that — you\'d need ' + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.payCable(smartcardNumber, amountNaira, provider);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        if (msg === '/help') {
            return 'Here\'s what I can help you with:\n\nHi — open or check your wallet\n/balance — see how much KAS you\'ve got\n/send [phone] [amount] — send KAS to someone\n/redeem [code] — top up with a voucher code\n/airtime [network] [phone] [amount] — buy airtime\n/electricity [provider] [meter number] [amount] — pay electricity\n/water [provider] [account number] [amount] — pay water\n/cable [provider] [smartcard number] [amount] — pay cable\n/help — show this menu again';
        }
        return 'Sorry, I didn\'t quite catch that. Type /help to see everything I can do.';
    },
};
