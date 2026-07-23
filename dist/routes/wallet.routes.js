"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const router = (0, express_1.Router)();
router.post('/create-wallet', wallet_controller_1.createWallet);
router.get('/balance/:phone', wallet_controller_1.getBalance);
router.post('/send', wallet_controller_1.sendMoney);
exports.default = router;
