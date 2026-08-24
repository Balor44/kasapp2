import axios from 'axios';


export const KnsService = {
  /**
   * Resolves a .kas domain to its corresponding Kaspa wallet address
   * @param domain The .kas domain (e.g., "balor.kas")
   * @returns The resolved kaspa:q... address or null if not found
   */
  resolveDomain: async (domain: string): Promise<string | null> => {
    try {
      const cleanDomain = domain.toLowerCase().trim();
      
      // Defensive check: Only resolve domains that end in .kas
      if (!cleanDomain.endsWith('.kas')) {
        return null;
      }


      // FIX 1: The KNS API expects the domain name WITHOUT the ".kas" extension!
      // So "balor.kas" becomes just "balor"
      const domainName = cleanDomain.replace('.kas', '');


      // KNS Public Resolution Endpoint
      const url = `https://api.knsdomains.org/mainnet/api/v1/domain/${domainName}`;
      const response = await axios.get(url, { timeout: 8000 }); 


      // FIX 2: Safely extract the data whether KNS wraps it in a 'data' object or an array
      const result = response.data?.data || response.data;
      const record = Array.isArray(result) ? result[0] : result;
      
      // Grab the address from the standard KNS fields
      const resolvedAddress = record?.ownerAddress || record?.owner || record?.address;


      // Ensure the returned data is actually a valid mainnet Kaspa address
      if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
        return resolvedAddress;
      }


      return null;
    } catch (error: any) {
      console.error(`[KNS Resolution Error] Failed to resolve ${domain}:`, error.message);
      return null;
    }
  }
};
