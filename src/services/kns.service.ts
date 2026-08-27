import axios from 'axios';


export const KnsService = {
  resolveDomain: async (domainInput: string): Promise<string | null> => {
    try {
      // 1. Strictly extract ONLY the domain name
      const match = domainInput.match(/([a-zA-Z0-9_-]+)\.kas/i);
      if (!match) return null;


      const domainName = match[1].toLowerCase();
      const cleanDomain = `${domainName}.kas`;


      // 2. Based on the Swagger doc, we hit the exact path variations
      const urlsToTry = [
        // Path A: The exact Swagger mapping with .kas
        `https://api.knsdomains.org/mainnet/api/v1/${cleanDomain}/owner`,
        
        // Path B: The exact Swagger mapping WITHOUT .kas
        `https://api.knsdomains.org/mainnet/api/v1/${domainName}/owner`,


        // Path C: The standard lookup mapping with .kas
        `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}/owner`,


        // Path D: The standard lookup mapping WITHOUT .kas
        `https://api.knsdomains.org/mainnet/api/v1/domain/${domainName}/owner`
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
          
          // Hunt down the Kaspa address no matter how KNS structures the JSON
          const resolvedAddress = 
            payload?.owner || 
            payload?.data?.owner || 
            payload?.ownerAddress ||
            (typeof payload === 'string' ? payload : null);


          if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
            console.log(`✅ [KNS] Successfully resolved ${cleanDomain} using URL: ${url}`);
            return resolvedAddress.trim();
          }
        } catch (e: any) {
           // It's normal for some of the URLs in the array to fail with 404, we just keep trying
        }
      }
      
      console.error(`❌ [KNS] All endpoint variations failed for ${cleanDomain}`);
      return null;


    } catch (error) {
      console.error(`[KNS Service Error]:`, error);
      return null;
    }
  }
};