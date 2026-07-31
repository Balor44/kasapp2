"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
if (process.env.NODE_ENV !== 'production') {
    dotenv_1.default.config();
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const waitlist_routes_1 = __importDefault(require("./routes/waitlist.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const redeem_routes_1 = __importDefault(require("./routes/redeem.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const billpay_routes_1 = __importDefault(require("./routes/billpay.routes"));
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
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', product: 'Kasapp' });
});
// --------------------------------------------------------------------------
// FRONTEND STATIC SERVING (EXPRESS 5 COMPATIBLE)
// --------------------------------------------------------------------------
const distPath = path_1.default.join(__dirname, '../dist');
// Serve compiled JS, CSS, and asset files from the dist folder
app.use(express_1.default.static(distPath));
// Catch-all fallback route using RegExp wildcard for Express 5 compatibility
app.get(/(.*)/, (req, res) => {
    // Pass non-existent /api calls to standard 404 instead of returning index.html
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path_1.default.join(distPath, 'index.html'));
});
exports.default = app;
