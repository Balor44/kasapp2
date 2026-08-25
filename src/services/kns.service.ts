import axios from 'axios';


export const KnsService = {
  /**
   * Resolves a .kas domain to its corresponding Kaspa wallet address
   */
  resolveDomain: async (domain: string): Promise<string | null> => {
    try {
      const cleanDomain = domain.toLowerCase().trim();
      if (!cleanDomain.endsWith('.kas')) return null;


      const domainName = cleanDomain.replace('.kas', '');


      // Self-Healing: Try both URL structures because KNS API versions vary
      const urlsToTry = [
        `https://api.knsdomains.org/mainnet/api/v1/domain/${domainName}`, // Without .kas (e.g., "balor")
        `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}` // With .kas (e.g., "balor.kas")
      ];


      for (const url of urlsToTry) {
        try {
          // Spoof Chrome to bypass KNS firewalls
          const response = await axios.get(url, { 
            timeout: 8000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
          }); 
          
          console.log(`[KNS API Success] Hit: ${url} | Response:`, JSON.stringify(response.data));


          const payload = response.data;
          const record = payload?.data || payload?.result || (Array.isArray(payload) ? payload[0] : payload);
          
          // Aggressively hunt for the Kaspa address in the payload
          const resolvedAddress = 
            record?.ownerAddress || 
            record?.owner || 
            record?.address || 
            record?.wallet || 
            record?.owner_address;


          if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
            return resolvedAddress; // Found it! Return immediately.
          }
        } catch (e: any) {
           // Silently catch the 404 and let the loop try the next URL format
           console.log(`[KNS Try Failed] URL: ${url} | Error:`, e?.response?.status || e.message);
        }
      }


      console.error(`[KNS Resolution Error] Could not extract a valid kaspa: address for ${domain}.`);
      return null;


    } catch (error: any) {
      console.error(`[KNS Resolution Error] Fatal:`, error?.message);
      return null;
    }
  }
};
