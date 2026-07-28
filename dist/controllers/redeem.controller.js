"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemCard = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const kaspa_service_1 = require("../wallet/kaspa.service");
const phone_1 = require("../utils/phone");
const OPERATOR_MNEMONIC = process.env.OPERATOR_WALLET_MNEMONIC;
const redeemCard = async (req, res) => {
    try {
        const { phone: rawPhone, code } = req.body;
        const phone = (0, phone_1.normalizePhone)(rawPhone);
        console.log('[REDEEM DEBUG] phone:', phone, 'code:', code);
        if (!phone || !code) {
            res.status(400).json({ error: 'phone and code are required' });
            return;
        }
        const user = await User_1.UserModel.findOne({ phone });
        console.log('[REDEEM DEBUG] user found:', !!user);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const card = await RechargeCard_1.RechargeCardModel.findOne({ code, used: false });
        console.log('[REDEEM DEBUG] card query result:', card);
        if (!card) {
            res.status(404).json({ error: 'Invalid or already used code' });
            return;
        }
        const txid = await kaspa_service_1.KaspaService.sendKAS(OPERATOR_MNEMONIC, user.wallet, card.amount);
        card.used = true;
        card.usedBy = phone;
        card.usedAt = new Date();
        await card.save();
        user.balance += card.amount;
        await user.save();
        res.json({
            credited: card.amount.toFixed(4) + ' KAS',
            newBalance: user.balance.toFixed(4) + ' KAS',
            txid,
        });
    }
    catch (error) {
        console.error('[REDEEM ERROR]', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
exports.redeemCard = redeemCard;
