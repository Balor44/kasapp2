import axios from 'axios';


export const KnsService = {
  /**
   * Resolves a .kas domain to its corresponding Kaspa wallet address
   */
  resolveDomain: async (domainInput: string): Promise<string | null> => {
    try {
      const match = domainInput.match(/([a-zA-Z0-9_-]+)\.kas/i);
      if (!match) return null;


      const domainName = match[1].toLowerCase(); 
      const cleanDomain = `${domainName}.kas`;


      // 🚨 NEW: Prioritize Enterprise indexers (api.kaspa.com) over community ones!
      const urlsToTry = [
        // 1. Kaspa.com Enterprise API (without .kas)
        `https://api.kaspa.com/api/v1/kns/domain/${domainName}`,
        
        // 2. Kaspa.com Enterprise API (with .kas)
        `https://api.kaspa.com/api/v1/kns/domain/${cleanDomain}`,
        
        // 3. Official KNS App API
        `https://api.knsdomains.org/mainnet/api/v1/domain/${domainName}`,
        `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}`
      ];


      for (const url of urlsToTry) {
        try {
          const response = await axios.get(url, { 
            timeout: 8000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            }
          }); 
          
          console.log(`[KNS API Success] Hit: ${url} | Payload:`, JSON.stringify(response.data));


          const payload = response.data;
          // Hunt for the data block
          const record = payload?.data || payload?.result || (Array.isArray(payload) ? payload[0] : payload);
          
          // Hunt for the Kaspa address
          const resolvedAddress = 
            record?.ownerAddress || 
            record?.owner || 
            record?.address || 
            record?.wallet || 
            record?.owner_address ||
            record?.kaspaAddress;


          if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
            return resolvedAddress;
          }
        } catch (e: any) {
           console.log(`[KNS Try Failed] URL: ${url} | Error:`, e?.response?.status || e.message);
        }
      }


      console.error(`[KNS Resolution Error] Could not find valid on-chain record for ${domainName}.`);
      return null;


    } catch (error: any) {
      console.error(`[KNS Resolution Error] Fatal:`, error?.message);
      return null;
    }
  }
};