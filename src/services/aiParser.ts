import dotenv from 'dotenv';
import OpenAI from 'openai';


dotenv.config();


const GROQ_API_KEY = process.env.GROQ_API_KEY || "";


// Pointing the OpenAI SDK directly to Groq's blazing fast servers
const openai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
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
  targetPhone?: string | null; // <--- ADDED: To capture third-party recharges
  voucherCode?: string | null;
  pin?: string | null;
  meterNumber?: string | null;
  confidence: number;
  conversationalReply?: string | null;
}


export async function parseWhatsAppMessage(userMessage: string): Promise<IntentResponse> {
  if (!GROQ_API_KEY) {
    console.error("[Kasapp AI Parser] GROQ_API_KEY is missing.");
    return { intent: "UNKNOWN", confidence: 0 };
  }


  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-oss-20b", // Standard fast groq model (feel free to change back if you had a specific alias)
      messages: [
        {
          role: "system",
          content: `You are Kasapp, a conversational, witty AI assistant for a Kaspa crypto wallet in Nigeria.
          Your job is to classify user intent and generate context-aware conversational replies.


          ALLOWED INTENTS:
          - "BALANCE": User wants to check their wallet balance.
          - "REDEEM_VOUCHER": User wants to redeem a Kaspa voucher. Extract the code into 'voucherCode' (e.g., 'KASP-XYZ123').
          - "SEND_KAS": User wants to send/transfer Kaspa (KAS). Extract "amount" (number) and "recipient".
          - "BUY_AIRTIME": User wants to buy airtime. Extract "amount" (number), "provider" (e.g., MTN, GLO), and IF they specify a phone number to send it to, extract it as "targetPhone".
          - "BUY_DATA": User wants to buy internet data. Extract "amount" (number), "provider", and IF they specify a phone number, extract it as "targetPhone".
          - "PAY_ELECTRICITY": User wants to pay electricity bill. Extract "amount", "provider" (e.g., IKEDC), and "meterNumber".
          - "SET_PIN": User wants to create or update their security PIN. Extract "pin" (string of 4-6 digits).
          - "HELP": User greets, makes small talk, or asks for help.
          - "UNKNOWN": Message is completely unrelated.


           DYNAMIC CONVERSATIONAL RULES:
          - For "HELP" or greetings, generate a fresh, varied response in natural Nigerian-English/Pidgin matching the user's energy. Keep it under 2 sentences.


          Return strict JSON:
          {
            "intent": "BALANCE" | "SEND_KAS" | "BUY_AIRTIME" | "BUY_DATA" | "PAY_ELECTRICITY" | "REDEEM_VOUCHER" | "SET_PIN" | "HELP" | "UNKNOWN",
            "amount": number | null,
            "recipient": string | null,
            "provider": string | null,
            "targetPhone": string | null,
            "meterNumber": string | null,
            "confidence": number,
            "conversationalReply": string | null,
            "pin": string | null,
            "voucherCode": string | null
           }`
        },
        {
          role: "user",
          content: `Extract intent and parameters from this: "${userMessage}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });


    const content = completion?.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error(`[Kasapp AI Parser] Empty response from Groq.`);
      return { intent: "UNKNOWN", confidence: 0 };
    }


    console.log(`[Kasapp AI Parser] Raw AI Output:`, content);
      
    const cleanContent = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanContent) as IntentResponse;
      
    if (parsed.intent) parsed.intent = parsed.intent.toUpperCase() as any;
      
    return parsed;
    
  } catch (error: any) {
    console.error(`[Kasapp AI Parser] Fatal API Error:`, error?.response?.data || error?.message || error);
  }


  return { intent: "UNKNOWN", confidence: 0 };
}