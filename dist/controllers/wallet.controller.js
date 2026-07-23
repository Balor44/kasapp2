"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMoney = exports.getBalance = exports.createWallet = void 0;
const User_1 = require("../models/User");
const kaspa_service_1 = require("../wallet/kaspa.service");
const createWallet = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            res.status(400).json({ error: 'phone is required' });
            return;
        }
        const existing = await User_1.UserModel.findOne({ phone });
        if (existing) {
            res.status(409).json({ error: 'Wallet already exists' });
            return;
        }
        const { publicKey, secret } = await kaspa_service_1.KaspaService.generateWallet();
        const user = await User_1.UserModel.create({
            phone,
            wallet: publicKey,
            mnemonic: secret,
            balance: 0,
        });
        res.status(201).json({ phone: user.phone, wallet: publicKey, balance: 0 });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
exports.createWallet = createWallet;
const getBalance = async (req, res) => {
    try {
        const { phone } = req.params;
        const user = await User_1.UserModel.findOne({ phone });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const liveBalance = await kaspa_service_1.KaspaService.getBalance(user.wallet);
        res.json({ wallet: user.wallet, balance: liveBalance.toFixed(4) + ' KAS' });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getBalance = getBalance;
const sendMoney = async (req, res) => {
    try {
        const { from, to, amount } = req.body;
        if (!from || !to || !amount) {
            res.status(400).json({ error: 'from, to, and amount are required' });
            return;
        }
        const sender = await User_1.UserModel.findOne({ phone: from });
        const receiver = await User_1.UserModel.findOne({ phone: to });
        if (!sender) {
            res.status(404).json({ error: 'Sender not found' });
            return;
        }
        if (!receiver) {
            res.status(404).json({ error: 'Recipient not found' });
            return;
        }
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            res.status(400).json({ error: 'Invalid amount' });
            return;
        }
        if (!sender.mnemonic) {
            res.status(400).json({ error: 'Sender wallet missing key material' });
            return;
        }
        const txid = await kaspa_service_1.KaspaService.sendKAS(sender.mnemonic, receiver.wallet, amt);
        res.json({ status: 'success', txid });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
exports.sendMoney = sendMoney;
