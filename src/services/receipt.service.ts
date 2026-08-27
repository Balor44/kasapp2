// src/services/receipt.service.ts


export interface SendKasReceiptParams {
  amount: number | string;
  recipient: string;
  txId?: string | null;
  newBalance?: string | null;
  fiatValueNgn?: string | number | null;
}


export interface BillReceiptParams {
  type: 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'TV';
  provider: string;
  target: string;
  amountNgn: number | string;
  kasDeducted?: number | string | null;
  reference?: string | null;
  token?: string | null;
  units?: string | null;
}


export const ReceiptService = {
  /**
   * Generates a sleek, world-class receipt for on-chain KAS transfers
   */
  formatSendKasReceipt: (params: SendKasReceiptParams): string => {
    const date = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'medium',
      timeStyle: 'short',
    });


    const displayAmount = params.amount ?? '0';
    const displayRecipient = params.recipient?.trim() || 'Kaspa Recipient';


    const rawTx = params.txId?.trim();
    const shortTx = rawTx && rawTx.length > 16
      ? `${rawTx.slice(0, 8)}...${rawTx.slice(-8)}`
      : rawTx || 'Confirmed on DAG';


    const explorerUrl = rawTx && rawTx.length > 20
      ? `https://explorer.kaspa.org/txs/${rawTx}`
      : null;


    let receipt =
      `🧾 *TRANSACTION RECEIPT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Status:* 🟢 Successful\n` +
      `*Service:* KAS Transfer\n` +
      `*Amount:* *${displayAmount} KAS*\n` +
      `*To:* \`${displayRecipient}\`\n` +
      `*Fee:* < 0.0001 KAS\n` +
      `*Date:* ${date}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*TXID:* \`${shortTx}\`\n`;


    if (params.newBalance) {
      receipt += `*New Balance:* ${params.newBalance} KAS\n`;
    }


    if (explorerUrl) {
      receipt += `\n🔗 _View on Explorer:_\n${explorerUrl}\n`;
    }


    receipt += `\n_Powered by Kasapp_ ⚡`;


    return receipt;
  },


  /**
   * Generates a world-class receipt for Utility & Bill Payments
   */
  formatBillReceipt: (params: BillReceiptParams): string => {
    const date = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'medium',
      timeStyle: 'short',
    });


    const ref = params.reference || `KAS-${Date.now().toString().slice(-8)}`;
    const isElectricity = params.type === 'ELECTRICITY';
    const providerName = params.provider?.toUpperCase() || 'SERVICE PROVIDER';
    const targetValue = params.target?.trim() || 'Beneficiary';
    const amountVal = params.amountNgn ? Number(params.amountNgn).toLocaleString() : '0';


    let receipt =
      `🧾 *${params.type} RECEIPT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Status:* 🟢 Successful\n` +
      `*Provider:* ${providerName}\n` +
      `*${isElectricity ? 'Meter' : 'Phone'}:* \`${targetValue}\`\n` +
      `*Amount:* *₦${amountVal}*\n` +
      (params.kasDeducted ? `*KAS Deducted:* ${params.kasDeducted} KAS\n` : '') +
      `*Ref:* \`${ref}\`\n` +
      `*Date:* ${date}\n`;


    // Special formatting block for prepaid electricity tokens
    if (isElectricity && params.token) {
      receipt +=
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ *TOKEN PIN:* \n` +
        `\`\`\`${params.token}\`\`\`\n` +
        (params.units ? `*Units:* ${params.units}\n` : '');
    } else if (params.type === 'DATA' && params.units) {
      receipt += `*Data Plan:* ${params.units}\n`;
    }


    receipt +=
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Powered by Kasapp_ 🚀`;


    return receipt;
  }
};
