"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const connect_1 = require("./database/connect");
const recurringPayments_cron_1 = require("./jobs/recurringPayments.cron");
const PORT = process.env.PORT || 3000;
console.log(process.env);
console.log('VERIFY TOKEN', process.env.WHATSAPP_VERIFY_TOKEN);
(0, recurringPayments_cron_1.initRecurringPaymentsCron)();
const start = async () => {
    await (0, connect_1.connectDB)();
    app_1.default.listen(PORT, () => {
        console.log('Kasapp is running');
        console.log('http://localhost:' + PORT + '/health');
    });
};
start();
