import axios from 'axios';


let cachedPrice: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 60000; 


export const PriceService = {
  getKaspaToNairaRate: async (): Promise<number> => {
    const now = Date.now();


    if (cachedPrice && (now - lastFetchTime < CACHE_DURATION_MS)) {
      return cachedPrice as number;
    }


    let livePrice = 0;


    try {
      // 1. Try CoinGecko First
      const cg = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=ngn', { timeout: 4000 });
      if (cg.data?.kaspa?.ngn) {
        livePrice = cg.data.kaspa.ngn;
        console.log(`[Price Oracle] CoinGecko Success: ₦${livePrice}`);
      }
    } catch (error) {
      console.warn('[Price Oracle] CoinGecko rate-limited on Railway. Trying MEXC...');
    }


    if (!livePrice) {
      try {
        // 2. Fallback to MEXC (Live KAS/USDT * 1600 NGN)
        const mexc = await axios.get('https://api.mexc.com/api/v3/ticker/price?symbol=KASUSDT', { timeout: 4000 });
        if (mexc.data?.price) {
          const kasUsdt = parseFloat(mexc.data.price);
          livePrice = kasUsdt * 1600; // Realistic USDT to NGN conversion
          console.log(`[Price Oracle] MEXC Success: $${kasUsdt} (~₦${livePrice})`);
        }
      } catch (error) {
        console.error('[Price Oracle Error] Both APIs failed.');
      }
    }


    if (!livePrice) {
      // 3. Absolute Fallback (Updated to real 2026 market range instead of 250)
      console.warn('[Price Oracle] Using hardcoded fallback.');
      livePrice = 40; 
    }


    cachedPrice = livePrice;
    lastFetchTime = now;
    return cachedPrice as number;
  }
};