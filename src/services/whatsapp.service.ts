import axios from 'axios';
import dotenv from 'dotenv';


dotenv.config();


const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';


/**
 * Sanitizes phone numbers specifically for Meta Graph API payloads.
 * Meta expects digits only (e.g., "2348012345678" or "12025550123"), with no leading '+' or spaces.
 */
function formatForMetaApi(phone: string): string {
  return phone.replace(/\D/g, '');
}


export const WhatsAppService = {
  /**
   * Primary method used to reply to inbound user messages and dispatch outbound alerts.
   */
  sendMessage: async (to: string, text: string): Promise<boolean> => {
    try {
      if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
        console.error('[WHATSAPP_ERROR] Missing PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env');
        return false;
      }


      const recipient = formatForMetaApi(to);


      const response = await axios.post(
        `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );


      console.log(`[WHATSAPP_SUCCESS] Sent to: ${recipient} | MsgID:`, response.data?.messages?.[0]?.id);
      return true;
    } catch (error: any) {
      console.error(
        '[WHATSAPP_FAILED] Destination:',
        to,
        '| Error:',
        error.response?.data || error.message
      );
      return false;
    }
  },


  /**
   * Sends a Xara-style interactive message with clickable buttons.
   * Note: Meta limits buttons to a maximum of 3, and titles to 20 characters.
   */
  sendInteractiveButtons: async (to: string, text: string, buttons: { id: string; title: string }[]): Promise<boolean> => {
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


      const response = await axios.post(
        `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: text },
            action: { buttons: actionButtons }
          }
        },
        {
          headers: { 
            Authorization: `Bearer ${WHATSAPP_TOKEN}`, 
            'Content-Type': 'application/json' 
          }
        }
      );


      console.log(`[WHATSAPP_SUCCESS] Sent Buttons to: ${recipient}`);
      return true;
    } catch (error: any) {
      console.error('[WHATSAPP_FAILED] Button Send Error:', error.response?.data || error.message);
      return false;
    }
  }
};


/**
 * Standalone helper for asynchronous notifications (e.g., P2P recipient alerts).
 */
export async function sendWhatsAppNotification(toPhone: string, message: string): Promise<boolean> {
  return await WhatsAppService.sendMessage(toPhone, message);
}