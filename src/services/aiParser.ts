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
          Your job is to map user messages to exact intents and extract relevant variables.
          
          ALLOWED INTENTS:
          - "SEND_KAS": User wants to send, transfer, or dash Kaspa (KAS). Extract "amount" (number) and "recipient" (string: Kaspa address or phone number if provided).
          - "BUY_AIRTIME": User wants to buy or load airtime/recharge card. Extract "amount" (number) and "provider" (string: MTN, GLO, AIRTEL, 9MOBILE).
          - "HELP": User says a greeting ("hi", "what's up", "how far"), makes small talk, or asks for help/menu.
          - "UNKNOWN": User says something completely unrelated to the wallet.


          CRITICAL RULE FOR SMALL TALK/HELP:
          If the intent is "HELP", populate the "conversationalReply" field with a warm, natural Nigerian greeting (e.g., "Omo, I dey! What's the move today?"). Do NOT hallucinate commands.
          
          Return strict JSON matching this structure exactly:
          {
            "intent": "SEND_KAS" | "BUY_AIRTIME" | "HELP" | "UNKNOWN", 
            "amount": number | null, 
            "recipient": string | null, 
            "provider": string | null, 
            "confidence": number, 
            "conversationalReply": string | null
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
      console.log(`[Kasapp AI Parser] Raw AI Output:`, content);
      
      // FIX: Strip markdown code blocks if the AI decided to add them
      const cleanContent = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
      
      const parsed = JSON.parse(cleanContent) as IntentResponse;
      
      // Normalize intent casing just in case the AI returns "send_kas" instead of "SEND_KAS"
      if (parsed.intent) parsed.intent = parsed.intent.toUpperCase() as any;
      
      return parsed;
    }
  } catch (error: any) {
    console.error(`[Kasapp AI Parser] Error cleaning or parsing JSON:`, error?.message || error);
  }


  return { intent: "UNKNOWN", confidence: 0 };
}