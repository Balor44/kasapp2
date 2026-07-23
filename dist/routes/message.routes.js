"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
router.post('/message', message_controller_1.handleMessage);
router.get('/webhook', message_controller_1.verifyWebhook);
router.post('/webhook', message_controller_1.handleWebhook);
exports.default = router;
