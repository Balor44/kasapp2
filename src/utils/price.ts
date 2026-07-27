const FALLBACK_KAS_TO_NGN = 150;

export const getKASPriceInNaira = async (): Promise<number> => {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=ngn', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return FALLBACK_KAS_TO_NGN;
    const data = await res.json();
    const rate = data?.kaspa?.ngn;
    return rate && !isNaN(rate) ? rate : FALLBACK_KAS_TO_NGN;
  } catch {
    return FALLBACK_KAS_TO_NGN;
  }
};

export const nairaToKAS = async (nairaAmount: number): Promise<number> => {
  const rate = await getKASPriceInNaira();
  const margin = 1.05;
  return nairaAmount / (rate * margin);
};