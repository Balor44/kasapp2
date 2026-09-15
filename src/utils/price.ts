import axios from 'axios';


// In-Memory Cache Variables
let cachedPrice = 0;
let lastFetched = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds


export const getKASPriceInNaira = async (): Promise<number> => {
  const now = Date.now();


  // 1. Return cached price if it's still fresh (under 5 minutes old)
  if (cachedPrice > 0 && (now - lastFetched < CACHE_TTL_MS)) {
    return cachedPrice;
  }


  let livePrice = 0;


  // 2. Fetch fresh price from CoinGecko
  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=ngn',
      { timeout: 5000 }
    );
    
    const rate = res.data?.kaspa?.ngn;
    
    if (rate && !isNaN(rate)) {
      livePrice = rate;
      console.log(`[Price Oracle] Live KAS/NGN Rate Updated from CG: ₦${livePrice}`);
    }
  } catch (error: any) {
    console.warn(`[Price Oracle Error] CoinGecko failed: ${error.message}. Trying MEXC...`);
  }


  // 3. Fallback to MEXC if CoinGecko is rate-limited
  if (!livePrice) {
    try {
      const mexc = await axios.get('https://api.mexc.com/api/v3/ticker/price?symbol=KASUSDT', { timeout: 5000 });
      if (mexc.data?.price) {
        const kasUsdt = parseFloat(mexc.data.price);
        livePrice = kasUsdt * 1600; // Approximate USDT to NGN conversion
        console.log(`[Price Oracle] Live KAS/NGN Rate Updated from MEXC: ₦${livePrice}`);
      }
    } catch (error: any) {
      console.error(`[Price Oracle Error] MEXC also failed: ${error.message}`);
    }
  }


  // 4. Update cache if successful
  if (livePrice > 0) {
    cachedPrice = livePrice;
    lastFetched = now;
    return cachedPrice;
  }


  // 5. Fallback logic: Use a stale cache if available, otherwise FAIL CLOSED.
  if (cachedPrice > 0) {
    console.warn('[Price Oracle] APIs down. Using stale cache.');
    return cachedPrice;
  }


  // 🛡️ THE FIX: Never invent a price. If we have no data, reject the transaction.
  throw new Error("Unable to fetch live Kaspa market rates. Please try again later.");
};


export const nairaToKAS = async (nairaAmount: number): Promise<number> => {
  const rate = await getKASPriceInNaira();
 
  // 5% margin protects you against sudden crypto volatility between the time
  // the user sees the price and the time the transaction settles.
  const margin = 1.05;
 
  return nairaAmount / (rate * margin);
};


