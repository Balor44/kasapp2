import axios from 'axios';


export const KnsService = {
  resolveDomain: async (domainInput: string): Promise<string | null> => {
    try {
      // 1. Strictly extract ONLY the domain name, ignoring all other words/spaces
      const match = domainInput.match(/([a-zA-Z0-9_-]+)\.kas/i);
      if (!match) return null;


      const domainName = match[1].toLowerCase(); 
      const cleanDomain = `${domainName}.kas`;


      // 2. Race the top Enterprise and Community Indexers simultaneously
      const urlsToTry = [
        `https://api.kaspa.com/api/v1/kns/domain/${domainName}`, // Kaspa Enterprise
        `https://api.kaspa.com/api/v1/kns/domain/${cleanDomain}`, 
        `https://api.knsdomains.org/mainnet/api/v1/domain/${domainName}` // Official KNS
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
          
          const payload = response.data;
          const record = payload?.data || payload?.result || (Array.isArray(payload) ? payload[0] : payload);
          
          // Grab the address regardless of which API version responds
          const resolvedAddress = 
            record?.ownerAddress || 
            record?.owner || 
            record?.address || 
            record?.wallet || 
            record?.kaspaAddress;


          if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
            return resolvedAddress;
          }
        } catch (e) {
           // Silently fail and try the next URL in the list
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }
};