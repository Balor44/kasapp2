import dotenv from 'dotenv';
import OpenAI from 'openai'; // Standard OpenAI SDK works with any OpenAI-compatible gateway


dotenv.config();


const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || "";
const AGENTROUTER_BASE_URL = "https://agentrouter.org/v1"; // Or your specific gateway endpoint


const openai = new OpenAI({
  apiKey: AGENTROUTER_API_KEY,
  baseURL: AGENTROUTER_BASE_URL,
});


export interface IntentResponse {
  intent:
    | "BALANCE"
    | "SEND_KAS"
    | "BUY_AIRTIME"
    | "BUY_DATA"
    | "PAY_ELECTRICITY"
    | "REDEEM_VOUCHER"
    | "HELP"
    | "UNKNOWN";
  amount?: number;
  recipient?: string;
  provider?: string;
  voucherCode?: string;
  confidence: number;
  conversationalReply?: string;
}


export async function parseWhatsAppMessage(userMessage: string): Promise<IntentResponse> {
  if (!AGENTROUTER_API_KEY) {
    console.error("[Kasapp AI Parser] AGENTROUTER_API_KEY is missing from environment variables.");
    return { intent: "UNKNOWN", confidence: 0 };
  }


  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Or whatever model name AgentRouter provides/recommends
      messages: [
        {
          role: "system",
          content: "You are the natural language parser for Kasapp. Map user messages to defined intents and return strict JSON matching the requested structure."
        },
        {
          role: "user",
          content: `Extract intent and parameters from this WhatsApp message for a payment bot: "${userMessage}"`
        }
      ],
      response_format: { type: "json_object" },
    });


    const content = completion.choices[0]?.message?.content;
    if (content) {
      console.log(`[Kasapp AI Parser] Success using AgentRouter:`, content);
      return JSON.parse(content) as IntentResponse;
    }
  } catch (error: any) {
    console.error(`[Kasapp AI Parser] AgentRouter request failed:`, error?.message || error);
  }


  return { intent: "UNKNOWN", confidence: 0 };
}