import dotenv from 'dotenv';
import OpenAI from 'openai';


dotenv.config();


const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || "";
const AGENTROUTER_BASE_URL = "https://agentrouter.org/v1";


const openai = new OpenAI({
  apiKey: AGENTROUTER_API_KEY,
  baseURL: "https://agentrouter.org/v1",
  defaultHeaders: {
    // Drop the custom app names and spoof a completely normal Chrome Browser
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://agentrouter.org",
    "Referer": "https://agentrouter.org/"
  }
});


export interface IntentResponse {
  intent:
    | "BALANCE"
    | "SEND_KAS"
    | "BUY_AIRTIME"
    | "BUY_DATA"
    | "PAY_ELECTRICITY"
    | "REDEEM_VOUCHER"
    | "SET_PIN"
    | "HELP"
    | "UNKNOWN";
  amount?: number | null;
  recipient?: string | null;
  provider?: string | null;
  voucherCode?: string | null;
  pin?: string | null;
  meterNumber?: string | null; // <-- FIX: Added this so TypeScript stops throwing errors!
  confidence: number;
  conversationalReply?: string | null;
}


export async function parseWhatsAppMessage(userMessage: string): Promise<IntentResponse> {
  if (!AGENTROUTER_API_KEY) {
    console.error("[Kasapp AI Parser] AGENTROUTER_API_KEY is missing.");
    return { intent: "UNKNOWN", confidence: 0 };
  }


  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-sol", // Try deepseek-v4f or opus 4.8 if this fails
      messages: [
        {
          role: "system",
          content: `You are Kasapp, a conversational, witty AI assistant for a Kaspa crypto wallet in Nigeria.
          Your job is to classify user intent and generate context-aware conversational replies.


          ALLOWED INTENTS:
          - "BALANCE": User wants to check their wallet balance.
          - "SEND_KAS": User wants to send/transfer Kaspa. Extract "amount" (number) and "recipient".
          - "BUY_AIRTIME": User wants to buy airtime. Extract "amount" (number) and "provider".
          - "BUY_DATA": User wants to buy internet data. Extract "amount" (number) and "provider".
          - "PAY_ELECTRICITY": User wants to pay electricity bill. Extract "amount", "provider", and "meterNumber".
          - "SET_PIN": User wants to create or update their security PIN. Extract "pin" (string of 4-6 digits).
          - "HELP": User greets, makes small talk, or asks for help.
          - "UNKNOWN": Message is completely unrelated.


          DYNAMIC CONVERSATIONAL RULES:
          - For "HELP" or greetings, generate a fresh, varied response in natural Nigerian-English/Pidgin matching the user's energy.
          - Keep conversational replies under 2 sentences.


          YOU MUST RESPOND ONLY IN VALID JSON FORMAT. NO MARKDOWN, NO EXTRA TEXT.
          {
            "intent": "BALANCE" | "SEND_KAS" | "BUY_AIRTIME" | "BUY_DATA" | "PAY_ELECTRICITY" | "SET_PIN" | "HELP" | "UNKNOWN",
            "amount": number | null,
            "recipient": string | null,
            "provider": string | null,
            "meterNumber": string | null,
            "confidence": number,
            "conversationalReply": string | null,
            "pin": string | null
          }`
        },
        {
          role: "user",
          content: `Extract intent and parameters from this: "${userMessage}"`
        }
      ],
      // FIX 1: Removed response_format: { type: "json_object" } to prevent AgentRouter model incompatibility crashes
      temperature: 0.1
    });


    // FIX 2: Defensive chaining to handle AgentRouter WAF rejections gracefully
    const content = completion?.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error(`[Kasapp AI] AgentRouter API returned an empty or invalid structure:`, JSON.stringify(completion));
      return { intent: "UNKNOWN", confidence: 0 };
    }


    console.log(`[Kasapp AI Parser] Raw AI Output:`, content);
     
    // Strip markdown code blocks in case the model ignores the "no markdown" rule
    const cleanContent = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanContent) as IntentResponse;
     
    if (parsed.intent) parsed.intent = parsed.intent.toUpperCase() as any;
     
    return parsed;
    
  } catch (error: any) {
    // FIX 3: Log the ACTUAL error payload from AgentRouter so we can see if it's blocking the key
    console.error(`[Kasapp AI Parser] Fatal API Error:`, error?.response?.data || error?.message || error);
  }

  return { intent: "UNKNOWN", confidence: 0 }
};