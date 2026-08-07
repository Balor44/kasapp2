"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillPayService = exports.CABLE_PROVIDERS = exports.DATA_PROVIDERS = exports.NETWORK_PROVIDERS = exports.ELECTRICITY_PROVIDERS = void 0;
const axios_1 = __importDefault(require("axios"));
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';
// ============================================================================
// PROVIDER MAPPINGS
// ============================================================================
exports.ELECTRICITY_PROVIDERS = {
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
exports.NETWORK_PROVIDERS = {
    MTN: 'MOB_MTN',
    AIRTEL: 'MOB_AIRTEL',
    GLO: 'MOB_GLO',
    '9MOBILE': 'MOB_9MOBILE',
    ETISALAT: 'MOB_9MOBILE',
};
exports.DATA_PROVIDERS = {
    MTN: { code: 'BIL108', name: 'MTN Mobile Data' },
    AIRTEL: { code: 'BIL109', name: 'Airtel Mobile Data' },
    GLO: { code: 'BIL110', name: 'Glo Mobile Data' },
    '9MOBILE': { code: 'BIL111', name: '9mobile Data' },
};
exports.CABLE_PROVIDERS = {
    DSTV: 'BIL121',
    GOTV: 'BIL122',
    STARTIMES: 'BIL123',
    SHOWMAX: 'BIL124',
};
// ============================================================================
// BILL PAYMENT SERVICE EXECUTION
// ============================================================================
exports.BillPayService = {
    /**
     * 1. BUY AIRTIME (MTN, Airtel, Glo, 9mobile)
     */
    buyAirtime: async (phone, amountNaira, network) => {
        try {
            const providerCode = exports.NETWORK_PROVIDERS[network.toUpperCase()];
            if (!providerCode) {
                return { success: false, message: `❌ Unsupported network. Supported: MTN, AIRTEL, GLO, 9MOBILE.` };
            }
            const txRef = `KASAPP-AIRTIME-${Date.now()}`;
            const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/bills`, { country: 'NG', customer: phone, amount: amountNaira, type: providerCode, reference: txRef }, { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } });
            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: `📱 *Airtime Purchase Successful!*\n\n• *Network:* ${network.toUpperCase()}\n• *Phone:* ${phone}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
                    reference: txRef,
                };
            }
            else {
                return { success: false, message: `❌ Airtime delivery failed: ${response.data.message || 'Provider error'}` };
            }
        }
        catch (error) {
            console.error('[BillPay Airtime Error]:', error.response?.data || error.message);
            return { success: false, message: '❌ Bill payment gateway error. Please try again in a few moments.' };
        }
    },
    /**
     * 2. BUY MOBILE DATA BUNDLES (MTN, Airtel, Glo, 9mobile)
     */
    buyData: async (phone, amountNaira, network) => {
        try {
            const provider = exports.DATA_PROVIDERS[network.toUpperCase()];
            if (!provider) {
                return { success: false, message: `❌ Unsupported network for data. Supported: MTN, AIRTEL, GLO, 9MOBILE.` };
            }
            const txRef = `KASAPP-DATA-${Date.now()}`;
            const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/bills`, { country: 'NG', customer: phone, amount: amountNaira, type: provider.code, reference: txRef }, { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } });
            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: `📶 *Data Top-up Successful!*\n\n• *Network:* ${network.toUpperCase()}\n• *Phone:* ${phone}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
                    reference: txRef,
                };
            }
            else {
                return { success: false, message: `❌ Data purchase failed: ${response.data.message || 'Provider error'}` };
            }
        }
        catch (error) {
            console.error('[BillPay Data Error]:', error.response?.data || error.message);
            return { success: false, message: '❌ Mobile data provider network busy. Please try again shortly.' };
        }
    },
    /**
     * 3. PAY ELECTRICITY (All 11 Nigerian DisCos)
     */
    payElectricity: async (meterNumber, amountNaira, providerKey) => {
        try {
            const provider = exports.ELECTRICITY_PROVIDERS[providerKey.toUpperCase()];
            if (!provider) {
                const validList = Object.keys(exports.ELECTRICITY_PROVIDERS).join(', ');
                return { success: false, message: `❌ Invalid Electricity Provider.\n\nSupported DisCos: *${validList}*` };
            }
            const txRef = `KASAPP-ELEC-${Date.now()}`;
            const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/bills`, { country: 'NG', customer: meterNumber, amount: amountNaira, type: provider.code, reference: txRef }, { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } });
            if (response.data.status === 'success') {
                const token = response.data.data?.token || 'Sent via SMS';
                return {
                    success: true,
                    message: `💡 *Electricity Token Generated!*\n\n• *DisCo:* ${provider.name}\n• *Meter:* ${meterNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Token:* \`${token}\`\n\n• *Ref:* \`${txRef}\``,
                    reference: txRef,
                    token,
                };
            }
            else {
                return { success: false, message: `❌ Electricity payment failed: ${response.data.message || 'Vendor error'}` };
            }
        }
        catch (error) {
            console.error('[BillPay Electricity Error]:', error.response?.data || error.message);
            return { success: false, message: '❌ Failed to process electricity token. Check meter number and try again.' };
        }
    },
    /**
     * 4. PAY CABLE TV (DSTV, GOTV, StarTimes, Showmax)
     */
    payCable: async (smartcardNumber, amountNaira, providerKey) => {
        try {
            const billCode = exports.CABLE_PROVIDERS[providerKey.toUpperCase()];
            if (!billCode) {
                return { success: false, message: '❌ Invalid Cable Provider. Supported: DSTV, GOTV, STARTIMES, SHOWMAX.' };
            }
            const txRef = `KASAPP-CABLE-${Date.now()}`;
            const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/bills`, { country: 'NG', customer: smartcardNumber, amount: amountNaira, type: billCode, reference: txRef }, { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } });
            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: `📺 *Cable TV Subscription Active!*\n\n• *Provider:* ${providerKey.toUpperCase()}\n• *Smartcard/IUC:* ${smartcardNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
                    reference: txRef,
                };
            }
            else {
                return { success: false, message: `❌ Cable renewal failed: ${response.data.message || 'Provider error'}` };
            }
        }
        catch (error) {
            console.error('[BillPay Cable Error]:', error.response?.data || error.message);
            return { success: false, message: '❌ Cable subscription failed. Please verify your Smartcard/IUC number.' };
        }
    },
    /**
     * 5. PAY WATER BILLS (LSWC, etc.)
     */
    payWater: async (accountNumber, amountNaira, providerKey) => {
        try {
            const txRef = `KASAPP-WATER-${Date.now()}`;
            const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/bills`, { country: 'NG', customer: accountNumber, amount: amountNaira, type: 'BIL125', reference: txRef }, { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } });
            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: `💧 *Water Bill Paid!*\n\n• *Provider:* ${providerKey.toUpperCase()}\n• *Account:* ${accountNumber}\n• *Amount:* ₦${amountNaira.toLocaleString()}\n• *Ref:* \`${txRef}\``,
                    reference: txRef,
                };
            }
            else {
                return { success: false, message: `❌ Water payment failed: ${response.data.message || 'Provider error'}` };
            }
        }
        catch (error) {
            console.error('[BillPay Water Error]:', error.response?.data || error.message);
            return { success: false, message: '❌ Water bill payment error. Please check your account number and try again.' };
        }
    },
};
