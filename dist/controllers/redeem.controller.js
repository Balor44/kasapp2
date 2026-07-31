"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemCard = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const phone_1 = require("../utils/phone");
const voucherCode_1 = require("../utils/voucherCode");
const redeemCard = async (req, res) => {
    try {
        const { phone: rawPhone, code: rawCode } = req.body;
        const phone = (0, phone_1.normalizePhone)(rawPhone);
        const code = (0, voucherCode_1.normalizeVoucherCode)(rawCode);
        console.log('[REDEEM DEBUG] rawPhone:', rawPhone, 'rawCode:', rawCode);
        console.log('[REDEEM DEBUG] normalized phone:', phone, 'code:', code, 'codeLength:', code?.length);
        if (!phone || !code || code.length !== 14) {
            console.log('[REDEEM REJECTED] Validation check failed');
            res.status(400).json({ error: 'phone and code are required' });
            return;
        }
        const user = await User_1.UserModel.findOne({ phone });
        console.log('[REDEEM DEBUG] user found:', !!user);
        if (!user) {
            console.log('[REDEEM REJECTED] Phone number not found in DB:', phone);
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const card = await RechargeCard_1.RechargeCardModel.findOneAndUpdate({ code, used: false }, { $set: { used: true, usedBy: phone, usedAt: new Date() } }, { new: true });
        console.log('[REDEEM DEBUG] card query result:', card);
        if (!card) {
            console.log('[REDEEM REJECTED] MongoDB query for card returned null:', code);
            res.status(404).json({ error: 'Invalid or already used code' });
            return;
        }
        user.balance += card.amount;
        await user.save();
        res.json({
            credited: card.amount.toFixed(4) + ' KAS',
            newBalance: user.balance.toFixed(4) + ' KAS',
        });
    }
    catch (error) {
        console.error('[REDEEM ERROR]', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
exports.redeemCard = redeemCard;
