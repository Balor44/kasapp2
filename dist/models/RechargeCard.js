"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeCardModel = void 0;
const mongoose_1 = require("mongoose");
const RechargeCardSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    used: { type: Boolean, default: false },
    usedBy: { type: String },
    usedAt: { type: Date },
});
// Explicitly set 'rechargecards' as the third parameter to enforce collection name consistency
exports.RechargeCardModel = (0, mongoose_1.model)('RechargeCard', RechargeCardSchema, 'rechargecards');
