import axios from 'axios';

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

export const WhatsAppService = {
  sendMessage: async (to: string, text: string): Promise<void> => {
    try {
      await axios.post(
        'https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages',
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: 'Bearer ' + WHATSAPP_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
    }
  },
};