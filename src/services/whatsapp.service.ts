import axios from 'axios';


// Fallback to capture token regardless of key name used in .env
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
};


/**
 * Standalone helper for asynchronous notifications (e.g., P2P recipient alerts).
 */
export async function sendWhatsAppNotification(toPhone: string, message: string): Promise<boolean> {
  return await WhatsAppService.sendMessage(toPhone, message);
}