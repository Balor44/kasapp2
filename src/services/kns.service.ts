import axios from 'axios';


export const KnsService = {
  /**
   * Resolves a .kas domain to its corresponding Kaspa wallet address
   * @param domain The .kas domain (e.g., "obinna.kas")
   * @returns The resolved kaspa:q... address or null if not found
   */
  resolveDomain: async (domain: string): Promise<string | null> => {
    try {
      const cleanDomain = domain.toLowerCase().trim();
      
      // Defensive check: Only resolve domains that end in .kas
      if (!cleanDomain.endsWith('.kas')) {
        return null;
      }


      // KNS Public Resolution Endpoint
      const url = `https://api.knsdomains.org/mainnet/api/v1/domain/${cleanDomain}`;
      const response = await axios.get(url, { timeout: 8000 }); // 8-second timeout


      // Depending on the KNS API schema, the wallet address is usually nested in one of these fields. 
      // We check them all to ensure compatibility.
      const resolvedAddress = response.data?.ownerAddress || response.data?.owner || response.data?.address;


      // Ensure the returned data is actually a valid mainnet address
      if (resolvedAddress && resolvedAddress.startsWith('kaspa:')) {
        return resolvedAddress;
      }


      return null;
    } catch (error: any) {
      // Only log the actual message so we don't pollute the console with giant Axios traces
      console.error(`[KNS Resolution Error] Failed to resolve ${domain}:`, error.message);
      return null;
    }
  }
};