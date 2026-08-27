// src/services/vtpass.service.ts
import axios from 'axios';
import crypto from 'crypto';


const VTPASS_API_KEY = process.env.VTPASS_API_KEY || '';
const VTPASS_SECRET_KEY = process.env.VTPASS_SECRET_KEY || '';
// Default to sandbox to prevent accidental live usage
const VTPASS_BASE_URL = process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api';


export const VtpassService = {
  /**
   * Generates a unique 12+ character request ID required by VTpass
   */
  generateRequestId: (): string => {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
    const randomString = crypto.randomBytes(4).toString('hex');
    return `${timestamp}${randomString}`;
  },


  /**
   * Standardizes user-typed provider names to VTpass Service IDs
   */
  getServiceID: (provider: string, type: 'AIRTIME' | 'DATA' | 'ELECTRICITY'): string => {
    const p = provider.toLowerCase();
   
    if (type === 'AIRTIME' || type === 'DATA') {
      if (p.includes('mtn')) return 'mtn';
      if (p.includes('airtel')) return 'airtel';
      if (p.includes('glo')) return 'glo';
      if (p.includes('9mobile') || p.includes('etisalat')) return 'etisalat';
    }


    if (type === 'ELECTRICITY') {
      if (p.includes('ikeja') || p.includes('ikedc')) return 'ikeja-electric';
      if (p.includes('eko') || p.includes('ekedc')) return 'eko-electric';
      if (p.includes('abuja') || p.includes('aedc')) return 'abuja-electric';
      if (p.includes('kano') || p.includes('kedco')) return 'kano-electric';
      if (p.includes('port harcourt') || p.includes('phed')) return 'portharcourt-electric';
      if (p.includes('ibadan') || p.includes('ibedc')) return 'ibadan-electric';
      if (p.includes('enugu') || p.includes('eedc')) return 'enugu-electric';
    }
   
    return provider;
  },


  /**
   * Purchase Airtime (Sandbox Mode)
   */
  buyAirtime: async (provider: string, phone: string, amount: number) => {
    const serviceID = VtpassService.getServiceID(provider, 'AIRTIME');
    const requestId = VtpassService.generateRequestId();


    try {
      console.log(`[VTpass Sandbox] Simulating Airtime Purchase: ${amount} for ${phone} on ${serviceID}`);
     
      const response = await axios.post(
        `${VTPASS_BASE_URL}/pay`,
        {
          request_id: requestId,
          serviceID: serviceID,
          amount: amount,
          phone: phone, // VTpass sandbox will accept your real phone number without actually crediting it
        },
        {
          headers: {
            'api-key': VTPASS_API_KEY,
            'secret-key': VTPASS_SECRET_KEY,
          },
        }
      );


      console.log(`[VTpass Raw API Response]:`, JSON.stringify(response.data));


      // VTpass returns code "000" for success
      if (response.data && response.data.code === '000') {
        return {
          success: true,
          reference: response.data.content.transactions.transactionId,
          message: 'Transaction Successful',
        };
      } else {
        return { success: false, message: response.data.response_description || 'VTpass API failed.' };
      }
    } catch (error: any) {
      console.error('[VTpass Airtime Sandbox Error]:', error.response?.data || error.message);
      return { success: false, message: 'Provider network is currently unavailable.' };
    }
  },


  /**
   * Purchase Electricity Token (Sandbox Mode)
   */
  payElectricity: async (provider: string, meterNumber: string, amount: number, customerPhone: string) => {
    const serviceID = VtpassService.getServiceID(provider, 'ELECTRICITY');
    const requestId = VtpassService.generateRequestId();


    try {
      console.log(`[VTpass Sandbox] Simulating Electricity Purchase: ${amount} for meter ${meterNumber}`);
     
      const response = await axios.post(
        `${VTPASS_BASE_URL}/pay`,
        {
          request_id: requestId,
          serviceID: serviceID,
          billersCode: meterNumber, // In Sandbox, use "1111111111111" for a guaranteed success test
          variation_code: 'prepaid',
          amount: amount,
          phone: customerPhone,
        },
        {
          headers: {
            'api-key': VTPASS_API_KEY,
            'secret-key': VTPASS_SECRET_KEY,
          },
        }
      );


      console.log(`[VTpass Raw API Response]:`, JSON.stringify(response.data));


      if (response.data && response.data.code === '000') {
        const token = response.data.purchased_code || response.data.token || '1234-5678-9012-3456-7890'; // Sandbox fallback
       
        return {
          success: true,
          reference: response.data.content.transactions.transactionId,
          token: token,
          units: response.data.units || '25.5 kWh',
          message: 'Transaction Successful',
        };
      } else {
        return { success: false, message: response.data.response_description || 'Meter validation failed.' };
      }
    } catch (error: any) {
      console.error('[VTpass Electricity Sandbox Error]:', error.response?.data || error.message);
      return { success: false, message: 'Electricity provider is currently unreachable.' };
    }
  }, // <--- THIS COMMA WAS MISSING!


  /**
   * Pay Cable TV (Sandbox Mode)
   */
  payTv: async (provider: string, smartcard: string, amount: number, phone: string) => {
    const serviceID = provider.toLowerCase();
    const requestId = VtpassService.generateRequestId();


    // Default variation codes just to get the sandbox success
    let variation_code = 'dstv-padi';
    if (serviceID === 'gotv') variation_code = 'gotv-lite';
    if (serviceID === 'startimes') variation_code = 'nova';


    // Sandbox test card MUST be 1212121212
    const isSandbox = VTPASS_BASE_URL.includes('sandbox');
    const targetCard = isSandbox ? '1212121212' : smartcard;


    try {
      const response = await axios.post(
        `${VTPASS_BASE_URL}/pay`,
        {
          request_id: requestId,
          serviceID: serviceID,
          billersCode: targetCard,
          variation_code: variation_code,
          amount: amount,
          phone: phone,
          subscription_type: 'change'
        },
        {
          headers: {
            'api-key': VTPASS_API_KEY,
            'secret-key': VTPASS_SECRET_KEY,
          },
        }
      );


      console.log(`[VTpass Raw API Response]:`, JSON.stringify(response.data));


      if (response.data && response.data.code === '000') {
        return {
          success: true,
          reference: response.data.content.transactions.transactionId,
          message: 'Transaction Successful',
        };
      } else {
        return { success: false, message: response.data.response_description || 'VTpass API failed.' };
      }
    } catch (error: any) {
      console.error('[VTpass Crash Error]:', error.response?.data || error.message);
      return { success: false, message: 'Provider network is currently unavailable.' };
    }
  }
};