"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillPayService = void 0;
const NETWORKS = ['MTN', 'Airtel', 'Glo', '9mobile'];
const ELECTRICITY_PROVIDERS = ['EKEDC', 'IKEDC', 'AEDC', 'PHED'];
const CABLE_PROVIDERS = ['DSTV', 'GOTV', 'StarTimes'];
const WATER_PROVIDERS = ['LSWC'];
function generateReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ref = 'KAS-';
    for (let i = 0; i < 10; i++)
        ref += chars[Math.floor(Math.random() * chars.length)];
    return ref;
}
exports.BillPayService = {
    buyAirtime: async (phone, amountNaira, network) => {
        if (!NETWORKS.includes(network)) {
            return { success: false, reference: '', message: 'Unsupported network. Choose: ' + NETWORKS.join(', ') };
        }
        return {
            success: true,
            reference: generateReference(),
            message: network + ' airtime of NGN ' + amountNaira.toLocaleString() + ' sent to ' + phone,
        };
    },
    payElectricity: async (meterNumber, amountNaira, provider) => {
        if (!ELECTRICITY_PROVIDERS.includes(provider)) {
            return { success: false, reference: '', message: 'Unsupported provider. Choose: ' + ELECTRICITY_PROVIDERS.join(', ') };
        }
        return {
            success: true,
            reference: generateReference(),
            message: provider + ' electricity token of NGN ' + amountNaira.toLocaleString() + ' issued for meter ' + meterNumber,
        };
    },
    payWater: async (accountNumber, amountNaira, provider) => {
        if (!WATER_PROVIDERS.includes(provider)) {
            return { success: false, reference: '', message: 'Unsupported provider. Choose: ' + WATER_PROVIDERS.join(', ') };
        }
        return {
            success: true,
            reference: generateReference(),
            message: provider + ' water bill of NGN ' + amountNaira.toLocaleString() + ' paid for account ' + accountNumber,
        };
    },
    payCable: async (smartcardNumber, amountNaira, provider) => {
        if (!CABLE_PROVIDERS.includes(provider)) {
            return { success: false, reference: '', message: 'Unsupported provider. Choose: ' + CABLE_PROVIDERS.join(', ') };
        }
        return {
            success: true,
            reference: generateReference(),
            message: provider + ' subscription of NGN ' + amountNaira.toLocaleString() + ' paid for smartcard ' + smartcardNumber,
        };
    },
};
