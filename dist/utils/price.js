"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nairaToKAS = exports.getKASPriceInNaira = void 0;
const axios_1 = __importDefault(require("axios"));
// A more realistic default fallback just in case the server boots up during a CoinGecko outage
const FALLBACK_KAS_TO_NGN = 250;
// In-Memory Cache Variables
let cachedPrice = 0;
let lastFetched = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const getKASPriceInNaira = async () => {
    const now = Date.now();
    // 1. Return cached price if it's still fresh (under 5 minutes old)
    if (cachedPrice > 0 && (now - lastFetched < CACHE_TTL_MS)) {
        return cachedPrice;
    }
    // 2. Fetch fresh price from CoinGecko
    try {
        const res = await axios_1.default.get('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=ngn', { timeout: 5000 });
        const rate = res.data?.kaspa?.ngn;
        if (rate && !isNaN(rate)) {
            cachedPrice = rate;
            lastFetched = now;
            console.log(`[Price Oracle] Live KAS/NGN Rate Updated: ₦${rate}`);
            return rate;
        }
    }
    catch (error) {
        console.warn(`[Price Oracle Error] Failed to fetch live rate: ${error.message}`);
    }
    // 3. Fallback logic: Use the old cache if the API is down, otherwise use the hardcoded fallback
    return cachedPrice > 0 ? cachedPrice : FALLBACK_KAS_TO_NGN;
};
exports.getKASPriceInNaira = getKASPriceInNaira;
const nairaToKAS = async (nairaAmount) => {
    const rate = await (0, exports.getKASPriceInNaira)();
    // 5% margin protects you against sudden crypto volatility between the time 
    // the user sees the price and the time the transaction settles.
    const margin = 1.05;
    return nairaAmount / (rate * margin);
};
exports.nairaToKAS = nairaToKAS;
