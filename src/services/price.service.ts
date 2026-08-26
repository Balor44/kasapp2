// src/services/price.service.ts
import axios from 'axios';


let cachedPrice: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 60000; // Cache the price for 60 seconds


export const PriceService = {
  /**
   * Fetches the real-time Kaspa to NGN exchange rate.
   */
  getKaspaToNairaRate: async (): Promise<number> => {
    const now = Date.now();


    // Return the cached price if it's less than 60 seconds old
    if (cachedPrice && (now - lastFetchTime < CACHE_DURATION_MS)) {
      return cachedPrice as number; // <--- ADDED 'as number'
    }


    try {
      // Fetch live KAS/NGN price from CoinGecko
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=ngn'
      );


      if (response.data && response.data.kaspa && response.data.kaspa.ngn) {
        cachedPrice = response.data.kaspa.ngn;
        lastFetchTime = now;
        console.log(`[Price Oracle] Updated live KAS/NGN rate: ₦${cachedPrice}`);
        return cachedPrice as number; // <--- ADDED 'as number'
      } else {
        throw new Error('Invalid response structure from CoinGecko');
      }
    } catch (error) {
      console.error('[Price Oracle Error]: Could not fetch live Kaspa price.', error);
      
      // If the API fails but we have an old cached price, use it as a fallback
      if (cachedPrice) {
        console.warn('[Price Oracle] Using stale cached price as fallback.');
        return cachedPrice as number; // <--- ADDED 'as number'
      }
      
      // Absolute fallback
      return 250; 
    }
  }
};