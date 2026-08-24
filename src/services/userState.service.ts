import Redis from 'ioredis';
import dotenv from 'dotenv';


dotenv.config();


// Connect to Redis (Cloud URL in production, local for testing)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisClient = new Redis(REDIS_URL);


redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});


// 1. COMBINED INTERFACE
export interface UserState {
  step: string;
  
  // Existing fields for recurring payments
  draftSub?: any;
  cancelList?: any[];
  cancelSubId?: string;
  
  // New fields for NLP & Transactions
  intent?: string;      // e.g., 'send_crypto', 'buy_airtime'
  amount?: number;      // e.g., 50 (KAS) or 2000 (NGN)
  recipient?: string;   // Kaspa address or phone number
  provider?: string;     // MTN, Airtel, etc.
  retries?: number;     // Track invalid PIN attempts
  meterNumber?: string;  // For electricity payments
}


// Sessions expire after 5 minutes (300 seconds) of inactivity for security
const SESSION_TTL = 300; 


// 2. REDIS STATE FUNCTIONS
export async function getUserState(phone: string): Promise<UserState> {
  try {
    const data = await redisClient.get(`kasapp:state:${phone}`);
    if (!data) {
      // Default to IDLE so the AI Intent Parser knows to take over
      return { step: 'IDLE' };
    }
    return JSON.parse(data) as UserState;
  } catch (error) {
    console.error(`Error fetching state for ${phone}:`, error);
    return { step: 'IDLE' }; // Safe fallback
  }
}


export async function saveUserState(phone: string, state: UserState): Promise<void> {
  try {
    await redisClient.set(
      `kasapp:state:${phone}`,
      JSON.stringify(state),
      'EX',
      SESSION_TTL
    );
  } catch (error) {
    console.error(`Error saving state for ${phone}:`, error);
  }
}


export async function clearUserState(phone: string): Promise<void> {
  try {
    await redisClient.del(`kasapp:state:${phone}`);
  } catch (error) {
    console.error(`Error clearing state for ${phone}:`, error);
  }
}
