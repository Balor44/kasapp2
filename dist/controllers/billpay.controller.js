"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payCable = exports.payWater = exports.payElectricity = exports.buyAirtime = void 0;
const User_1 = require("../models/User");
const billpay_service_1 = require("../services/billpay.service");
const price_1 = require("../utils/price");
async function handleBillPayment(req, res, serviceFn, targetField) {
    try {
        const { phone, amount, provider } = req.body;
        const target = req.body[targetField];
        if (!phone || !target || !amount || !provider) {
            res.status(400).json({ error: 'phone, ' + targetField + ', amount, and provider are required' });
            return;
        }
        const user = await User_1.UserModel.findOne({ phone });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const requiredKAS = await (0, price_1.nairaToKAS)(amount);
        if (user.balance < requiredKAS) {
            res.status(400).json({ error: 'Insufficient balance. Need ' + requiredKAS.toFixed(4) + ' KAS' });
            return;
        }
        const result = await serviceFn(target, amount, provider);
        if (!result.success) {
            res.status(400).json({ error: result.message });
            return;
        }
        user.balance -= requiredKAS;
        await user.save();
        res.json({
            status: 'success',
            reference: result.reference,
            message: result.message,
            deducted: requiredKAS.toFixed(4) + ' KAS',
            newBalance: user.balance.toFixed(4) + ' KAS',
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
}
const buyAirtime = (req, res) => handleBillPayment(req, res, billpay_service_1.BillPayService.buyAirtime, 'targetPhone');
exports.buyAirtime = buyAirtime;
const payElectricity = (req, res) => handleBillPayment(req, res, billpay_service_1.BillPayService.payElectricity, 'meterNumber');
exports.payElectricity = payElectricity;
const payWater = (req, res) => handleBillPayment(req, res, billpay_service_1.BillPayService.payWater, 'accountNumber');
exports.payWater = payWater;
const payCable = (req, res) => handleBillPayment(req, res, billpay_service_1.BillPayService.payCable, 'smartcardNumber');
exports.payCable = payCable;
