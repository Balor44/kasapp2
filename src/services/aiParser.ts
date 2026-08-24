import dotenv from 'dotenv';
import OpenAI from 'openai';


dotenv.config();


const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || "";
const AGENTROUTER_BASE_URL = "https://agentrouter.org/api/v1"; // adjust to their exact v1 endpoint if needed


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
    console.error("[Kasapp AI Parser] AGENTROUTER_API_KEY is missing.");
    return { intent: "UNKNOWN", confidence: 0 };
  }


  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Or equivalent AgentRouter model
      messages: [
        {
          role: "system",
          content: `You are Kasapp, a conversational, warm AI assistant for a Kaspa crypto wallet in Nigeria.
          Your job is to map user messages to intents.
          
          CRITICAL RULE FOR SMALL TALK:
          If the user sends a greeting (like "hi", "what's up", "how far", "hello") or general small talk, set the intent to "HELP" and populate the "conversationalReply" field with a warm, natural Nigerian greeting (e.g., "Omo, I dey! What's the move today?"). Do NOT hallucinate commands.
          
          Return strict JSON matching this structure:
          {
            "intent": "...", 
            "amount": null, 
            "recipient": null, 
            "provider": null, 
            "confidence": 0.9, 
            "conversationalReply": "..."
          }`
        },
        {
          role: "user",
          content: `Extract intent and parameters from this: "${userMessage}"`
        }
      ],
      response_format: { type: "json_object" },
    });


    const content = completion.choices[0]?.message?.content;
    if (content) {
      console.log(`[Kasapp AI Parser] Parsed:`, content);
      return JSON.parse(content) as IntentResponse;
    }
  } catch (error: any) {
    console.error(`[Kasapp AI Parser] AgentRouter error:`, error?.message || error);
  }


  return { intent: "UNKNOWN", confidence: 0 };
}