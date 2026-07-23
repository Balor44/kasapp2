"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemCard = void 0;
const User_1 = require("../models/User");
const RechargeCard_1 = require("../models/RechargeCard");
const redeemCard = async (req, res) => {
    try {
        const { phone, code } = req.body;
        if (!phone || !code) {
            res.status(400).json({ error: 'phone and code are required' });
            return;
        }
        const user = await User_1.UserModel.findOne({ phone });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const card = await RechargeCard_1.RechargeCardModel.findOne({ code, used: false });
        if (!card) {
            res.status(404).json({ error: 'Invalid or already used code' });
            return;
        }
        card.used = true;
        card.usedBy = phone;
        card.usedAt = new Date();
        await card.save();
        user.balance += card.amount;
        await user.save();
        res.json({
            credited: card.amount.toFixed(4) + ' KAS',
            newBalance: user.balance.toFixed(4) + ' KAS',
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.redeemCard = redeemCard;
