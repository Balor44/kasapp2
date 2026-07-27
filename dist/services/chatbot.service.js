"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const kaspa_service_1 = require("../wallet/kaspa.service");
const billpay_service_1 = require("./billpay.service");
const price_1 = require("../utils/price");
exports.ChatbotService = {
    parse: async (phone, message) => {
        const msg = message.trim().toLowerCase();
        const user = await User_1.UserModel.findOne({ phone });
        if (msg === 'hi' || msg === 'hello' || msg === 'start') {
            if (user) {
                const balance = await kaspa_service_1.KaspaService.getBalance(user.wallet);
                return 'Welcome back to Kasapp!\nYour balance: ' + balance.toFixed(4) + ' KAS';
            }
            const { publicKey, secret } = await kaspa_service_1.KaspaService.generateWallet();
            await User_1.UserModel.create({
                phone,
                wallet: publicKey,
                mnemonic: secret,
                balance: 0,
            });
            return 'Welcome to Kasapp!\nYour wallet is ready.\n\nAddress:\n' + publicKey + '\n\nYOUR RECOVERY PHRASE (save this now, it will not be shown again):\n' + secret + '\n\nAnyone with this phrase can access your funds. Store it somewhere private and offline. Type /balance or /help to get started.';
        }
        if (msg === '/balance') {
            if (!user)
                return 'No wallet found. Say Hi to create one.';
            const balance = await kaspa_service_1.KaspaService.getBalance(user.wallet);
            return 'Your Kaspa Balance\n' + balance.toFixed(4) + ' KAS';
        }
        if (msg.startsWith('/send')) {
            const parts = msg.split(' ');
            if (parts.length < 3)
                return 'Usage: /send [phone] [amount]\nExample: /send 08012345678 10';
            if (!user)
                return 'No wallet found. Say Hi to create one.';
            if (!user.mnemonic)
                return 'Wallet error - missing key material.';
            const toPhone = parts[1];
            const amount = parseFloat(parts[2]);
            if (isNaN(amount) || amount <= 0)
                return 'Invalid amount.';
            const receiver = await User_1.UserModel.findOne({ phone: toPhone });
            if (!receiver)
                return toPhone + ' is not registered on Kasapp yet.';
            try {
                const txid = await kaspa_service_1.KaspaService.sendKAS(user.mnemonic, receiver.wallet, amount);
                return 'Sent ' + amount + ' KAS to ' + toPhone + '\nTxID: ' + txid.slice(0, 16) + '...';
            }
            catch (error) {
                return 'Transaction failed: ' + (error.message || 'unknown error');
            }
        }
        if (msg.startsWith('/redeem')) {
            const parts = msg.split(' ');
            if (parts.length < 2)
                return 'Usage: /redeem [code]';
            if (!user)
                return 'No wallet found. Say Hi to create one.';
            const code = parts[1].toUpperCase();
            const card = await RechargeCard_1.RechargeCardModel.findOne({ code, used: false });
            if (!card)
                return 'Invalid or already used code.';
            card.used = true;
            card.usedBy = phone;
            card.usedAt = new Date();
            await card.save();
            user.balance += card.amount;
            await user.save();
            return 'Topped up! ' + card.amount + ' KAS added.';
        }
        if (msg.startsWith('/airtime')) {
            const parts = msg.split(' ');
            if (parts.length < 4)
                return 'Usage: /airtime [network] [phone] [amount in naira]\nExample: /airtime MTN 08012345678 1000';
            if (!user)
                return 'No wallet found. Say Hi to create one.';
            const network = parts[1].toUpperCase();
            const targetPhone = parts[2];
            const amountNaira = parseFloat(parts[3]);
            if (isNaN(amountNaira) || amountNaira <= 0)
                return 'Invalid amount.';
            const requiredKAS = await (0, price_1.nairaToKAS)(amountNaira);
            if (user.balance < requiredKAS)
                return 'Insufficient balance. Need ' + requiredKAS.toFixed(4) + ' KAS.';
            const result = await billpay_service_1.BillPayService.buyAirtime(targetPhone, amountNaira, network);
            if (!result.success)
                return result.message;
            user.balance -= requiredKAS;
            await user.save();
            return result.message + '\nDeducted: ' + requiredKAS.toFixed(4) + ' KAS';
        }
        if (msg === '/help') {
            return 'Kasapp commands:\nHi - open your wallet\n/balance - check balance\n/send [phone] [amount] - send KAS\n/redeem [code] - redeem a voucher\n/airtime [network] [phone] [amount] - buy airtime\n/help - this menu';
        }
        if (msg === '/help') {
            return 'Kasapp commands:\nHi - open your wallet\n/balance - check balance\n/send [phone] [amount] - send KAS\n/redeem [code] - redeem a voucher\n/help - this menu';
        }
        return 'Unknown command. Type /help to see all options.';
    },
};
