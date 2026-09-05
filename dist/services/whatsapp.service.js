"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
exports.sendWhatsAppNotification = sendWhatsAppNotification;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
/**
 * Sanitizes phone numbers specifically for Meta Graph API payloads.
 * Meta expects digits only (e.g., "2348012345678" or "12025550123"), with no leading '+' or spaces.
 */
function formatForMetaApi(phone) {
    return phone.replace(/\D/g, '');
}
exports.WhatsAppService = {
    /**
     * Primary method used to reply to inbound user messages and dispatch outbound alerts.
     */
    sendMessage: async (to, text) => {
        try {
            if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
                console.error('[WHATSAPP_ERROR] Missing PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env');
                return false;
            }
            const recipient = formatForMetaApi(to);
            const response = await axios_1.default.post(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { body: text },
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });
            console.log(`[WHATSAPP_SUCCESS] Sent to: ${recipient} | MsgID:`, response.data?.messages?.[0]?.id);
            return true;
        }
        catch (error) {
            console.error('[WHATSAPP_FAILED] Destination:', to, '| Error:', error.response?.data || error.message);
            return false;
        }
    },
    /**
     * Sends a Xara-style interactive message with up to 3 clickable buttons.
     */
    sendInteractiveButtons: async (to, text, buttons) => {
        try {
            if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
                console.error('[WHATSAPP_ERROR] Missing credentials for interactive buttons');
                return false;
            }
            const recipient = formatForMetaApi(to);
            const actionButtons = buttons.map(btn => ({
                type: 'reply',
                reply: { id: btn.id, title: btn.title.substring(0, 20) }
            }));
            const response = await axios_1.default.post(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: text },
                    action: { buttons: actionButtons }
                }
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[WHATSAPP_SUCCESS] Sent Buttons to: ${recipient}`);
            return true;
        }
        catch (error) {
            console.error('[WHATSAPP_FAILED] Button Send Error:', error.response?.data || error.message);
            return false;
        }
    },
    /**
     * Sends a List Message (Drawer Menu) with up to 10 options.
     * Action button text is max 20 characters.
     */
    sendInteractiveList: async (to, text, buttonText, sections) => {
        try {
            if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
                console.error('[WHATSAPP_ERROR] Missing credentials for interactive list');
                return false;
            }
            const recipient = formatForMetaApi(to);
            const response = await axios_1.default.post(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: text },
                    action: {
                        button: buttonText.substring(0, 20),
                        sections: sections
                    }
                }
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[WHATSAPP_SUCCESS] Sent List Menu to: ${recipient}`);
            return true;
        }
        catch (error) {
            console.error('[WHATSAPP_FAILED] List Menu Send Error:', error.response?.data || error.message);
            return false;
        }
    }
};
/**
 * Standalone helper for asynchronous notifications (e.g., P2P recipient alerts).
 */
async function sendWhatsAppNotification(toPhone, message) {
    return await exports.WhatsAppService.sendMessage(toPhone, message);
}
