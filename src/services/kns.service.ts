import axios from 'axios';


export const KnsService = {
  resolveDomain: async (domainInput: string): Promise<string | null> => {
    try {
      // 1. Strictly extract ONLY the domain name
      const match = domainInput.match(/([a-zA-Z0-9_-]+)\.kas/i);
      if (!match) return null;


      const domainName = match[1].toLowerCase();
      const cleanDomain = `${domainName}.kas`;


      // 2. Query the specific /owner endpoint from the KNS Swagger Docs
      const urlsToTry = [
        `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}/owner`, // Primary: The exact endpoint you found
        `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}`        // Fallback: Standard metadata endpoint
      ];


      for (const url of urlsToTry) {
        try {
          const response = await axios.get(url, {
            timeout: 8000,
            headers: {
              "Accept": "application/json"
            }
          });
          
          const payload = response.data;
          
          // Handle all possible KNS API formats (raw string, {owner: "..."}, or {data: {owner: "..."}})
          const resolvedAddress = 
            payload?.owner || 
            payload?.data?.owner || 
            (typeof payload === 'string' ? payload : null);


          if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
            return resolvedAddress.trim();
          }
        } catch (e: any) {
           // Silently fail and try the next URL in the array
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[KNS Service Error]:`, error);
      return null;
    }
  }
};
