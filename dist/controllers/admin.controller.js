"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperatorBalance = void 0;
const kaspa_service_1 = require("../wallet/kaspa.service");
const getOperatorBalance = async (req, res) => {
    try {
        const address = process.env.OPERATOR_WALLET_ADDRESS;
        if (!address) {
            res.status(500).json({ error: 'OPERATOR_WALLET_ADDRESS not set' });
            return;
        }
        const balance = await kaspa_service_1.KaspaService.getBalance(address);
        res.json({ address, balance: balance.toFixed(4) + ' KAS' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
exports.getOperatorBalance = getOperatorBalance;
