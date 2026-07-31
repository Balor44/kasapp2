"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
exports.sendWhatsAppNotification = sendWhatsAppNotification;
const axios_1 = __importDefault(require("axios"));
// Fallback to ensure token is captured regardless of key name used in .env
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
exports.WhatsAppService = {
    /**
     * Primary method used by webhook/chatbot controller to reply to inbound user messages.
     */
    sendMessage: async (to, text) => {
        try {
            if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
                console.error('[WHATSAPP_ERROR] Missing PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env');
                return;
            }
            await axios_1.default.post(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });
        }
        catch (error) {
            console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
        }
    },
};
/**
 * Standalone helper used for outbound/asynchronous notifications (e.g. P2P recipient alerts).
 */
async function sendWhatsAppNotification(toPhone, message) {
    try {
        const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!phoneId || !token) {
            console.error('[WHATSAPP_NOTIFICATION_ERROR] Missing WHATSAPP_PHONE_NUMBER_ID or token in .env');
            return false;
        }
        const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
        const response = await axios_1.default.post(url, {
            messaging_product: 'whatsapp',
            to: toPhone,
            type: 'text',
            text: { body: message }
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[WHATSAPP_NOTIFICATION_SUCCESS] Dispatched to:', toPhone, response.data);
        return true;
    }
    catch (error) {
        console.error('[WHATSAPP_NOTIFICATION_FAILED]', error?.response?.data || error.message);
        return false;
    }
}
