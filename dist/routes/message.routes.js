"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
// 1. Meta / WhatsApp Cloud API Webhook Verification (GET)
router.get('/webhook', message_controller_1.verifyWebhook);
// 2. Meta / WhatsApp Cloud API Webhook Event Receiver (POST)
router.post('/webhook', message_controller_1.handleWebhook);
// 3. Direct JSON Endpoint for Manual Testing / Postman (POST)
router.post('/message', message_controller_1.handleMessage);
exports.default = router;
