"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhook = exports.handleWebhook = exports.handleMessage = void 0;
const chatbot_service_1 = require("../services/chatbot.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const phone_1 = require("../utils/phone");
const handleMessage = async (req, res) => {
    try {
        const { phone, message } = req.body;
        const normalizedPhone = (0, phone_1.normalizePhone)(phone);
        if (!normalizedPhone || !message) {
            res.status(400).json({ error: 'phone and message are required' });
            return;
        }
        const reply = await chatbot_service_1.ChatbotService.processIncomingMessage(normalizedPhone, message);
        res.json({ reply });
    }
    catch (error) {
        console.error('[handleMessage Error]:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.handleMessage = handleMessage;
const handleWebhook = async (req, res) => {
    // 1. Immediately acknowledge Meta to prevent webhook retries
    res.sendStatus(200);
    try {
        const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message)
            return;
        const rawPhone = message.from;
        const phone = (0, phone_1.normalizePhone)(rawPhone);
        // Default to empty string if message type is not text
        const text = message.text?.body || '';
        if (!text.trim())
            return;
        console.log(`[WhatsApp Webhook] From: ${phone} | Text: "${text}"`);
        // 2. Process message through ChatbotService engine
        const reply = await chatbot_service_1.ChatbotService.processIncomingMessage(phone, text);
        // 3. Dispatch outbound reply via WhatsApp API
        await whatsapp_service_1.WhatsAppService.sendMessage(phone, reply);
    }
    catch (error) {
        console.error('[handleWebhook Error]:', error);
    }
};
exports.handleWebhook = handleWebhook;
const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kasapp2-verify-token';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('[Webhook Verification Attempt]', { mode, token, expected: VERIFY_TOKEN });
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Webhook Verified Successfully!]');
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
};
exports.verifyWebhook = verifyWebhook;
