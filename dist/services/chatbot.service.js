"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const kaspa_service_1 = require("../wallet/kaspa.service");
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
            return 'Welcome to Kasapp!\nYour wallet is ready.\nAddress: ' + publicKey.slice(0, 24) + '...\nType /balance or /help to get started.';
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
        if (msg === '/help') {
            return 'Kasapp commands:\nHi - open your wallet\n/balance - check balance\n/send [phone] [amount] - send KAS\n/redeem [code] - redeem a voucher\n/help - this menu';
        }
        return 'Unknown command. Type /help to see all options.';
    },
};
