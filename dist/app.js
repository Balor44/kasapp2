"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const undici_1 = require("undici");
(0, undici_1.setGlobalDispatcher)(new undici_1.Agent({
    connect: {
        timeout: 30000, // Extends TCP socket timeout from default 10s to 30s
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
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const waitlist_routes_1 = __importDefault(require("./routes/waitlist.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const redeem_routes_1 = __importDefault(require("./routes/redeem.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const billpay_routes_1 = __importDefault(require("./routes/billpay.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes")); // <-- 1. IMPORT HERE
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/wallet', wallet_routes_1.default);
app.use('/api/billpay', billpay_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/redeem', redeem_routes_1.default);
app.use('/api', message_routes_1.default);
app.use('/api', waitlist_routes_1.default);
app.use('/api', whatsapp_routes_1.default); // <-- 2. MOUNT HERE (Exposes /api/whatsapp/webhook)
app.use('/api', payment_routes_1.default);
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', product: 'Kasapp' });
});
// --------------------------------------------------------------------------
// FRONTEND STATIC SERVING (MULTI-PATH GUARD)
// --------------------------------------------------------------------------
const candidates = [
    path_1.default.resolve(process.cwd(), 'dist-client'),
    path_1.default.resolve(process.cwd(), 'client', 'dist-client'),
    path_1.default.resolve(process.cwd(), 'dist'),
    path_1.default.join(__dirname, '../dist-client'),
    path_1.default.join(__dirname, '../dist'),
];
let distPath = candidates.find((dir) => fs_1.default.existsSync(path_1.default.join(dir, 'index.html'))) || candidates[0];
console.log(`[Kasapp Static] Serving frontend assets from: ${distPath}`);
app.use(express_1.default.static(distPath));
// Express 5 catch-all fallback
app.get(/(.*)/, (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    const indexPath = path_1.default.join(distPath, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    for (const cand of candidates) {
        const fallbackIndex = path_1.default.join(cand, 'index.html');
        if (fs_1.default.existsSync(fallbackIndex)) {
            return res.sendFile(fallbackIndex);
        }
    }
    res.status(500).send(`Build error: index.html was not found. Checked: ${candidates.join(', ')}`);
});
exports.default = app;
