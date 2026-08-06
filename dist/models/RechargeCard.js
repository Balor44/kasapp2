"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeCardModel = void 0;
const mongoose_1 = require("mongoose");
const RechargeCardSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    amountNaira: { type: Number },
    transactionRef: { type: String },
    purchasedByPhone: { type: String },
    used: { type: Boolean, default: false },
    usedBy: { type: String },
    usedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});
exports.RechargeCardModel = (0, mongoose_1.model)('RechargeCard', RechargeCardSchema);
