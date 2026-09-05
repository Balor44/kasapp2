"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RechargeCard_1 = require("../models/RechargeCard");
const voucherCode_1 = require("../utils/voucherCode");
const MONGO_URI = process.env.MONGODB_URI;
async function generateVouchers(amount, count) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        let saved = false;
        while (!saved) {
            const code = (0, voucherCode_1.generateVoucherCode)();
            try {
                await RechargeCard_1.RechargeCardModel.create({ code, amount, used: false });
                codes.push(code);
                saved = true;
            }
            catch (error) {
                if (error.code === 11000)
                    continue; // Retry on duplicate code
                throw error;
            }
        }
    }
    return codes;
}
async function main() {
    const [, , amountArg, countArg] = process.argv;
    const amount = parseFloat(amountArg);
    const count = parseInt(countArg, 10);
    if (!amount || amount <= 0 || !count || count <= 0) {
        console.error('Usage: npx ts-node scripts/generateVouchers.ts  ');
        console.error('Example: npx ts-node scripts/generateVouchers.ts 50 5');
        process.exit(1);
    }
    if (!MONGO_URI) {
        console.error('❌ MONGODB_URI is missing from your environment variables!');
        process.exit(1);
    }
    await mongoose_1.default.connect(MONGO_URI);
    console.log(`Generating ${count} voucher(s) worth ${amount} KAS each...`);
    const codes = await generateVouchers(amount, count);
    const filename = `vouchers-${amount}KAS-${Date.now()}.csv`;
    const filepath = path_1.default.join(process.cwd(), filename);
    const csvContent = ['code,amount', ...codes.map(c => `${c},${amount}`)].join('\n');
    fs_1.default.writeFileSync(filepath, csvContent);
    console.log(`✅ Done. ${codes.length} vouchers created and saved to live database.`);
    console.log(`📄 CSV written to: ${filepath}`);
    await mongoose_1.default.disconnect();
    process.exit(0);
}
main().catch((error) => {
    console.error('❌ Voucher generation failed:', error);
    process.exit(1);
});
