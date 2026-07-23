"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
exports.WhatsAppService = {
    sendMessage: async (to, text) => {
        try {
            await axios_1.default.post('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            }, {
                headers: {
                    Authorization: 'Bearer ' + WHATSAPP_TOKEN,
                    'Content-Type': 'application/json',
                },
            });
        }
        catch (error) {
            console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
        }
    },
};
