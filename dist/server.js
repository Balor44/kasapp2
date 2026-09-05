"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const connect_1 = require("./database/connect");
const recurringPayments_cron_1 = require("./jobs/recurringPayments.cron");
const PORT = process.env.PORT || 3000;
// Validate critical security environment variables on startup without logging values
const requiredEnv = ['ENCRYPTION_KEY', 'MONGODB_URI'];
for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
        console.error(`[FATAL] Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
(0, recurringPayments_cron_1.initRecurringPaymentsCron)();
const start = async () => {
    await (0, connect_1.connectDB)();
    app_1.default.listen(PORT, () => {
        console.log(`[Kasapp] Server running on port ${PORT}`);
        console.log(`[Kasapp] Health check at http://localhost:${PORT}/health`);
    });
};
start();
