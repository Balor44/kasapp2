"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhook = exports.handleWebhook = exports.handleMessage = void 0;
const chatbot_service_1 = require("../services/chatbot.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const handleMessage = async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        res.status(400).json({ error: 'phone and message are required' });
        return;
    }
    const reply = await chatbot_service_1.ChatbotService.parse(phone, message);
    res.json({ reply });
};
exports.handleMessage = handleMessage;
const handleWebhook = async (req, res) => {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
        res.sendStatus(200);
        return;
    }
    const phone = message.from;
    const text = message.text?.body || '';
    const reply = await chatbot_service_1.ChatbotService.parse(phone, text);
    await whatsapp_service_1.WhatsAppService.sendMessage(phone, reply);
    res.sendStatus(200);
};
exports.handleWebhook = handleWebhook;
const verifyWebhook = (req, res) => {
    console.log('mode:', req.query['hub.mode']);
    console.log('token:', req.query['hub.verify_token']);
    console.log('expected:', process.env.WHATSAPP_VERIFY_TOKEN);
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kasapp2-verify-token';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
};
exports.verifyWebhook = verifyWebhook;
