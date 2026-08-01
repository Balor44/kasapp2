import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';


dotenv.config();


const apiKey = process.env.GEMINI_API_KEY || "";


const ai = new GoogleGenAI({ 
  apiKey,
  httpOptions: { timeout: 30000 } 
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
  if (!apiKey) {
    console.error("[Kasapp AI Parser] GEMINI_API_KEY is missing from environment variables.");
    return { intent: "UNKNOWN", confidence: 0 };
  }


  // Active models (latest stable first)
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];


  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Extract intent and parameters from this WhatsApp message for a payment bot: "${userMessage}"`,
        config: {
          systemInstruction: `You are the natural language parser for Kasapp. Map user messages to defined intents.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: [
                  "BALANCE",
                  "SEND_KAS",
                  "BUY_AIRTIME",
                  "BUY_DATA",
                  "PAY_ELECTRICITY",
                  "REDEEM_VOUCHER",
                  "HELP",
                  "UNKNOWN"
                ],
              },
              amount: { type: Type.NUMBER },
              recipient: { type: Type.STRING },
              provider: { type: Type.STRING },
              voucherCode: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              conversationalReply: { type: Type.STRING }
            },
            required: ["intent", "confidence"],
          },
        },
      });


      if (response.text) {
        console.log(`[Kasapp AI Parser] Success using model (${model}):`, response.text);
        return JSON.parse(response.text) as IntentResponse;
      }
    } catch (error: any) {
      console.error(`[Kasapp AI Parser] Model ${model} failed:`, error?.message || error);
    }
  }


  return { intent: "UNKNOWN", confidence: 0 };
}