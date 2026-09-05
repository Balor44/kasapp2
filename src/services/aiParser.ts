import dotenv from 'dotenv';
import OpenAI from 'openai';


dotenv.config();


const GROQ_API_KEY = process.env.GROQ_API_KEY || "";


// Pointing the OpenAI SDK directly to Groq's high-speed API
const openai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});


export interface IntentResponse {
  intent:
    | "BALANCE"
    | "GET_ADDRESS"
    | "GET_SECRET_PHRASE"
    | "SEND_KAS"
    | "BUY_AIRTIME"
    | "BUY_DATA"
    | "PAY_ELECTRICITY"
    | "BUY_TV"
    | "REDEEM_VOUCHER"
    | "SET_PIN"
    | "HELP"
    | "CHAT"
    | "UNKNOWN";
  amount?: number | null;
  recipient?: string | null;
  provider?: string | null;
  targetPhone?: string | null;
  voucherCode?: string | null;
  pin?: string | null;
  meterNumber?: string | null;
  smartcardNumber?: string | null;
  confidence: number;
  conversationalReply?: string | null;
}


export async function parseWhatsAppMessage(userMessage: string): Promise<IntentResponse> {
  if (!GROQ_API_KEY) {
    console.error("[Kasapp AI Parser] GROQ_API_KEY is missing.");
    return {
      intent: "UNKNOWN",
      confidence: 0,
      conversationalReply: "Sorry, our AI service is currently unavailable. Please try again shortly."
    };
  }


  try {
    const completion = await openai.chat.completions.create({
      // You can use 'llama-3.3-70b-versatile' or 'llama-3.1-8b-instant' on Groq
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are Kasapp, an intelligent, conversational financial assistant for a Kaspa (KAS) wallet built for Africa on WhatsApp.


TONE & STYLE:
- Warm, polite, concise, and modern pan-African English.
- Avoid forced local slang or heavy pidgin so the experience is natural across Nigeria, Ghana, Kenya, South Africa, and beyond.
- Keep responses short and conversational (1 to 2 sentences max) suited for WhatsApp.


ALLOWED INTENTS:
- "GET_ADDRESS": User wants their Kaspa wallet deposit/receiving address or QR code (e.g., "what's my wallet address", "how do I deposit", "receive KAS", "show my address").
- "GET_SECRET_PHRASE": User asks for their recovery phrase, seed phrase, or private key (e.g., "what's my secret phrase", "show my seed", "view private key").
- "BALANCE": User wants to check their wallet balance.
- "SEND_KAS": User wants to send/transfer Kaspa. Extract "amount" (number) and "recipient" (phone number, KNS domain like name.kas, or kaspa: address).
- "BUY_AIRTIME": User wants airtime. Extract "amount" (number), "provider" (e.g., MTN, Airtel, Glo), and "targetPhone" if specified.
- "BUY_DATA": User wants internet data. Extract "amount" (number), "provider", and "targetPhone" if specified.
- "PAY_ELECTRICITY": User wants electricity tokens. Extract "amount", "provider", and "meterNumber".
- "BUY_TV": User wants cable TV subscription. Extract "amount", "provider" (e.g., DSTV, GOtv), and "smartcardNumber".
- "REDEEM_VOUCHER": User wants to redeem a voucher. Extract code into 'voucherCode' (e.g., 'KASP-XXXX-XXXX').
- "SET_PIN": User wants to set or reset security PIN. Extract 'pin' (4-6 digits).
- "HELP": User explicitly asks for instructions, guidance, or menu commands.
- "CHAT": User greets, makes small talk, asks questions about Kasapp, or enters text that does not trigger a direct financial transaction.
- "UNKNOWN": Completely unintelligible text or foreign characters.


CONVERSATIONAL RULES:
- ALWAYS generate a high-quality "conversationalReply".
- If the user greets or makes small talk ("CHAT"), respond naturally and mention what Kasapp can do (e.g., "Hello! I can help you send KAS, check your balance, view your deposit address, or pay utility bills. What would you like to do?").
- If the intent is unclear, ask a helpful clarifying question instead of sending a generic error.
- If missing details for a transaction (e.g., "send KAS" without amount or recipient), use "conversationalReply" to ask for the missing parameters.


Return STRICT JSON matching this structure:
{
  "intent": "GET_ADDRESS" | "GET_SECRET_PHRASE" | "BALANCE" | "SEND_KAS" | "BUY_AIRTIME" | "BUY_DATA" | "PAY_ELECTRICITY" | "BUY_TV" | "REDEEM_VOUCHER" | "SET_PIN" | "HELP" | "CHAT" | "UNKNOWN",
  "amount": number | null,
  "recipient": string | null,
  "provider": string | null,
  "targetPhone": string | null,
  "meterNumber": string | null,
  "smartcardNumber": string | null,
  "pin": string | null,
  "voucherCode": string | null,
  "confidence": number,
  "conversationalReply": string
}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });


    const content = completion?.choices?.[0]?.message?.content;
   
    if (!content) {
      console.error(`[Kasapp AI Parser] Empty response from Groq.`);
      return { 
        intent: "UNKNOWN", 
        confidence: 0,
        conversationalReply: "I didn't quite catch that. Could you please rephrase?"
      };
    }


    const cleanContent = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanContent) as IntentResponse;
     
    if (parsed.intent) parsed.intent = parsed.intent.toUpperCase() as any;
     
    return parsed;
   
  } catch (error: any) {
    console.error(`[Kasapp AI Parser] Fatal API Error:`, error?.response?.data || error?.message || error);
    return { 
      intent: "UNKNOWN", 
      confidence: 0,
      conversationalReply: "Something went wrong while processing your request. Please try again."
    };
  }
}


