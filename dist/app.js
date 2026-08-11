"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const undici_1 = require("undici");
// Extends TCP socket timeout from default 10s to 30s
(0, undici_1.setGlobalDispatcher)(new undici_1.Agent({
    connect: {
        timeout: 30000,
    },
    headersTimeout: 60000,
    bodyTimeout: 60000,
}));
// Disable local proxy interference
process.env.NO_PROXY = '*';
const dotenv_1 = __importDefault(require("dotenv"));
if (process.env.NODE_ENV !== 'production') {
    dotenv_1.default.config();
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Route Imports
const waitlist_routes_1 = __importDefault(require("./routes/waitlist.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const redeem_routes_1 = __importDefault(require("./routes/redeem.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const billpay_routes_1 = __importDefault(require("./routes/billpay.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const merchant_routes_1 = __importDefault(require("./routes/merchant.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/wallet', wallet_routes_1.default);
app.use('/api/billpay', billpay_routes_1.default);
app.use('/api/merchant', merchant_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/redeem', redeem_routes_1.default);
app.use('/api', message_routes_1.default);
app.use('/api', waitlist_routes_1.default);
app.use('/api', whatsapp_routes_1.default);
app.use('/api', payment_routes_1.default);
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', product: 'Kasapp' });
});
// --------------------------------------------------------------------------
// Global API 404 Catch-All (Express 5 Safe - NO ASTERISK)
// --------------------------------------------------------------------------
app.use((req, res) => {
    res.status(404).json({ error: 'API route not found' });
});
exports.default = app;
