"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const redeem_controller_1 = require("../controllers/redeem.controller");
const router = (0, express_1.Router)();
router.post('/redeem', redeem_controller_1.redeemCard);
exports.default = router;
