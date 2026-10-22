import axios from 'axios';


const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';


export interface BillPayResponse {
  /** True when the provider may have processed the request (timeout, no response). Never refund on this. */
  unknown?: boolean;
  success: boolean;
  message: string;
  reference?: string;
  token?: string; // Electricity prepaid meter token
}


// ============================================================================
// PROVIDER MAPPINGS
// ============================================================================


export const ELECTRICITY_PROVIDERS: Record<string, { code: string; name: string }> = {
  IKEDC: { code: 'IKEDC-ELECTRIC', name: 'Ikeja Electric' },
  EKEDC: { code: 'EKEDC-ELECTRIC', name: 'Eko Electricity' },
  AEDC: { code: 'AEDC-ELECTRIC', name: 'Abuja Electricity' },
  KEDCO: { code: 'KEDCO-ELECTRIC', name: 'Kano Electricity' },
  PHED: { code: 'PHED-ELECTRIC', name: 'Port Harcourt Electricity' },
  IBEDC: { code: 'IBEDC-ELECTRIC', name: 'Ibadan Electricity' },
  EEDC: { code: 'EEDC-ELECTRIC', name: 'Enugu Electricity' },
  KAEDCO: { code: 'KADUNA-ELECTRIC', name: 'Kaduna Electric' },
  JED: { code: 'JOS-ELECTRIC', name: 'Jos Electricity' },
  BEDC: { code: 'BENIN-ELECTRIC', name: 'Benin Electricity' },
  YEDC: { code: 'YOLA-ELECTRIC', name: 'Yola Electricity' },
};


export const NETWORK_PROVIDERS: Record<string, string> = {
  MTN: 'MOB_MTN',
  AIRTEL: 'MOB_AIRTEL',
  GLO: 'MOB_GLO',
  '9MOBILE': 'MOB_9MOBILE',
  ETISALAT: 'MOB_9MOBILE',
};


export const DATA_PROVIDERS: Record<string, { code: string; name: string }> = {
  MTN: { code: 'BIL108', name: 'MTN Mobile Data' },
  AIRTEL: { code: 'BIL109', name: 'Airtel Mobile Data' },
  GLO: { code: 'BIL110', name: 'Glo Mobile Data' },
  '9MOBILE': { code: 'BIL111', name: '9mobile Data' },
};


export const CABLE_PROVIDERS: Record<string, string> = {
  DSTV: 'BIL121',
  GOTV: 'BIL122',
  STARTIMES: 'BIL123',
  SHOWMAX: 'BIL124',
};




// ============================================================================
// BILL PAYMENT SERVICE EXECUTION
// ============================================================================


export const BillPayService = {

  /**
   * Looks a bill up by the reference it was sent with. A timeout on the original call is not a
   * failure, so this is how an unknown outcome gets resolved. Anything unclear stays PENDING.
   */
  status: async (reference: string): Promise<'DELIVERED' | 'FAILED' | 'PENDING'> => {
    try {
      const response = await axios.get(`${FLUTTERWAVE_BASE_URL}/bills/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
        timeout: 20000,
      });
      const state = String(response.data?.data?.status || response.data?.data?.processing_status || '').toLowerCase();
      if (['successful', 'success', 'completed', 'delivered'].includes(state)) return 'DELIVERED';
      if (['failed', 'reversed', 'cancelled'].includes(state)) return 'FAILED';
      return 'PENDING';
    } catch (error: any) {
      // A 404 right after a timeout can mean "not created yet", so it is not proof of failure either.
      return 'PENDING';
    }
  },
  
  /**
   * 1. BUY AIRTIME (MTN, Airtel, Glo, 9mobile)
   */
  buyAirtime: async (phone: string, amountNaira: number, network: string, reference?: string): Promise<BillPayResponse> => {
    try {
      const providerCode = NETWORK_PROVIDERS[network.toUpperCase()];
      if (!providerCode) {
        return { success: false, message: `❌ Unsupported network. Supported: MTN, AIRTEL, GLO, 9MOBILE.` };
      }


      const txRef = reference || `KASAPP-AIRTIME-${Date.now()}`;


      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/bills`,
        { country: 'NG', customer: phone, amount: amountNaira, type: providerCode, reference: txRef },
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        return {
          success: true,
          message: `📱 *Airtime Purchase Successful!*\n\n• *Network:* ${network.toUpperCase()}\n• *Phone:* ${phone}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
          reference: txRef,
        };
      } else {
        return { success: false, message: `❌ Airtime delivery failed: ${response.data.message || 'Provider error'}` };
      }
    } catch (error: any) {
      console.error('[BillPay Airtime Error]:', error.response?.data || error.message);
      return { success: false, unknown: !error.response, message: '❌ Bill payment gateway error. Please try again in a few moments.' };
    }
  },


  /**
   * 2. BUY MOBILE DATA BUNDLES (MTN, Airtel, Glo, 9mobile)
   */
  buyData: async (phone: string, amountNaira: number, network: string, reference?: string): Promise<BillPayResponse> => {
    try {
      const provider = DATA_PROVIDERS[network.toUpperCase()];
      if (!provider) {
        return { success: false, message: `❌ Unsupported network for data. Supported: MTN, AIRTEL, GLO, 9MOBILE.` };
      }


      const txRef = reference || `KASAPP-DATA-${Date.now()}`;


      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/bills`,
        { country: 'NG', customer: phone, amount: amountNaira, type: provider.code, reference: txRef },
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        return {
          success: true,
          message: `📶 *Data Top-up Successful!*\n\n• *Network:* ${network.toUpperCase()}\n• *Phone:* ${phone}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
          reference: txRef,
        };
      } else {
        return { success: false, message: `❌ Data purchase failed: ${response.data.message || 'Provider error'}` };
      }
    } catch (error: any) {
      console.error('[BillPay Data Error]:', error.response?.data || error.message);
      return { success: false, unknown: !error.response, message: '❌ Mobile data provider network busy. Please try again shortly.' };
    }
  },


  /**
   * 3. PAY ELECTRICITY (All 11 Nigerian DisCos)
   */
  payElectricity: async (meterNumber: string, amountNaira: number, providerKey: string, reference?: string): Promise<BillPayResponse> => {
    try {
      const provider = ELECTRICITY_PROVIDERS[providerKey.toUpperCase()];
      if (!provider) {
        const validList = Object.keys(ELECTRICITY_PROVIDERS).join(', ');
        return { success: false, message: `❌ Invalid Electricity Provider.\n\nSupported DisCos: *${validList}*` };
      }


      const txRef = reference || `KASAPP-ELEC-${Date.now()}`;


      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/bills`,
        { country: 'NG', customer: meterNumber, amount: amountNaira, type: provider.code, reference: txRef },
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        const token = response.data.data?.token || 'Sent via SMS';
        return {
          success: true,
          message: `💡 *Electricity Token Generated!*\n\n• *DisCo:* ${provider.name}\n• *Meter:* ${meterNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Token:* \`${token}\`\n\n• *Ref:* \`${txRef}\``,
          reference: txRef,
          token,
        };
      } else {
        return { success: false, message: `❌ Electricity payment failed: ${response.data.message || 'Vendor error'}` };
      }
    } catch (error: any) {
      console.error('[BillPay Electricity Error]:', error.response?.data || error.message);
      return { success: false, unknown: !error.response, message: '❌ Failed to process electricity token. Check meter number and try again.' };
    }
  },


  /**
   * 4. PAY CABLE TV (DSTV, GOTV, StarTimes, Showmax)
   */
  payCable: async (smartcardNumber: string, amountNaira: number, providerKey: string, reference?: string): Promise<BillPayResponse> => {
    try {
      const billCode = CABLE_PROVIDERS[providerKey.toUpperCase()];
      if (!billCode) {
        return { success: false, message: '❌ Invalid Cable Provider. Supported: DSTV, GOTV, STARTIMES, SHOWMAX.' };
      }


      const txRef = reference || `KASAPP-CABLE-${Date.now()}`;


      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/bills`,
        { country: 'NG', customer: smartcardNumber, amount: amountNaira, type: billCode, reference: txRef },
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        return {
          success: true,
          message: `📺 *Cable TV Subscription Active!*\n\n• *Provider:* ${providerKey.toUpperCase()}\n• *Smartcard/IUC:* ${smartcardNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
          reference: txRef,
        };
      } else {
        return { success: false, message: `❌ Cable renewal failed: ${response.data.message || 'Provider error'}` };
      }
    } catch (error: any) {
      console.error('[BillPay Cable Error]:', error.response?.data || error.message);
      return { success: false, unknown: !error.response, message: '❌ Cable subscription failed. Please verify your Smartcard/IUC number.' };
    }
  },


  /**
   * 5. PAY WATER BILLS (LSWC, etc.)
   */
  payWater: async (accountNumber: string, amountNaira: number, providerKey: string, reference?: string): Promise<BillPayResponse> => {
    try {
      const txRef = reference || `KASAPP-WATER-${Date.now()}`;


      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/bills`,
        { country: 'NG', customer: accountNumber, amount: amountNaira, type: 'BIL125', reference: txRef },
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        return {
          success: true,
          message: `💧 *Water Bill Paid!*\n\n• *Provider:* ${providerKey.toUpperCase()}\n• *Account:* ${accountNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
          reference: txRef,
        };
      } else {
        return { success: false, message: `❌ Water payment failed: ${response.data.message || 'Provider error'}` };
      }
    } catch (error: any) {
      console.error('[BillPay Water Error]:', error.response?.data || error.message);
      return { success: false, unknown: !error.response, message: '❌ Water bill payment error. Please check your account number and try again.' };
    }
  },
};