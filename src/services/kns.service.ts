import axios from 'axios';


export const KnsService = {
  resolveDomain: async (domainInput: string): Promise<string | null> => {
    try {
      // 1. Strictly extract ONLY the domain name, ignoring all other words/spaces
      const match = domainInput.match(/([a-zA-Z0-9_-]+)\.kas/i);
      if (!match) return null;


      const domainName = match[1].toLowerCase();
      const cleanDomain = `${domainName}.kas`;


      // 2. Query the official KNS Mainnet Endpoint
      const url = `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}`;


      try {
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            "Accept": "application/json"
          }
        });
        
        // The API returns the domain metadata; we just need the owner
        const resolvedAddress = response.data?.owner;


        if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
          return resolvedAddress;
        }
      } catch (e: any) {
        console.error(`[KNS API Error] Failed to resolve ${cleanDomain}:`, e.message);
      }
      
      return null;
    } catch (error) {
      console.error(`[KNS Service Error]:`, error);
      return null;
    }
  }
};