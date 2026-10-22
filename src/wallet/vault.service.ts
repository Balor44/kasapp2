// src/wallet/vault.service.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateVoucherCode } from '../utils/voucherCode';
import { KaspaService } from '../wallet/kaspa.service';
import { decryptMnemonic } from '../utils/crypto.utils';
import { getOperatorSeed } from '../utils/operator';
import { addressMatchesNetwork, addressPrefixFor } from '../utils/network';


// Optional: Load Argent artifact if covenants are deployed in your environment
const artifactPath = path.join(__dirname, '../../contracts/VoucherEscrow.json');
let escrowArtifact: any = null;


try {
  escrowArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  console.log('[VaultService] Argent covenant artifact loaded successfully.');
} catch (e) {
  console.warn('[VaultService] Argent artifact not found or compiled. Operating in custodial hot-vault mode.');
}


/**
 * Rules every voucher payout to an external address must pass: a valid address for the configured
 * network, and a second factor above the high value threshold. Returns an error string, or null.
 */
export function checkRedemptionPolicy(recipientAddress: string, amount: number, pinProvided?: string): string | null {
  const network = process.env.KASPA_NETWORK || 'mainnet';
  if (!addressMatchesNetwork(recipientAddress.trim(), network)) {
    return `Invalid destination address. Destination must be a valid '${addressPrefixFor(network)}:' address.`;
  }
  const SECURITY_THRESHOLD = 10000;
  if (amount >= SECURITY_THRESHOLD) {
    if (!pinProvided) return `SECURITY_LOCK: This voucher exceeds the ${SECURITY_THRESHOLD} KAS limit. Secondary 2FA PIN is required.`;
    const expectedPin = process.env.ARGENT_MASTER_PIN || '';
    const a = Buffer.from(String(pinProvided));
    const b = Buffer.from(expectedPin);
    if (!expectedPin || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'Invalid 2FA PIN. Vault remains locked.';
  }
  return null;
}

export const VaultService = {
  /**
   * Creates and funds a voucher escrow on-chain.
   */
  async createVoucherEscrow(
    senderMnemonic: string,
    amountKas: number
  ): Promise<{ success: boolean; voucherCode?: string; vaultAddress?: string; txId?: string; error?: string }> {
    try {
      const vaultAddress = (process.env.OPERATOR_WALLET_ADDRESS || '').trim();
      if (!vaultAddress) {
        throw new Error('OPERATOR_WALLET_ADDRESS is not configured in environment.');
      }


      // Decrypt sender mnemonic if encrypted
      let rawSenderMnemonic = senderMnemonic;
      if (!rawSenderMnemonic.includes(' ') && process.env.ENCRYPTION_KEY) {
        rawSenderMnemonic = decryptMnemonic(senderMnemonic, process.env.ENCRYPTION_KEY);
      }


      const secretCode = generateVoucherCode();


      console.log(`[VaultService] Funding ${amountKas} KAS escrow to vault address: ${vaultAddress}`);


      // Broadcast real funding transaction from creator to vault address
      const txId = await KaspaService.sendKAS(rawSenderMnemonic, vaultAddress, amountKas);


      console.log(`[VaultService] ✅ Escrow funded on-chain. TXID: ${txId}`);


      return {
        success: true,
        voucherCode: secretCode,
        vaultAddress: vaultAddress,
        txId: txId
      };
    } catch (error: any) {
      console.error('[VaultService] Escrow Creation Error:', error);
      return { success: false, error: error?.message || 'Failed to fund escrow on-chain.' };
    }
  },


  /**
   * Redeems a voucher and broadcasts real KAS to the recipient on-chain.
   */
  async redeemVoucherEscrow(
    recipientAddress: string,
    vaultAddress: string,
    secretCode: string,
    amount: number,
    pinProvided?: string
  ): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      console.log(`[VaultService] Executing on-chain voucher redemption: ${amount} KAS -> ${recipientAddress}`);


      const policyError = checkRedemptionPolicy(recipientAddress, amount, pinProvided);
      if (policyError) return { success: false, error: policyError };


      // 3. 🛡️ FIXED: Resolve operator vault mnemonic specifically from Railway variable
      const operatorSeed = getOperatorSeed();


      // 4. Broadcast the real on-chain transaction to the recipient
      const txId = await KaspaService.sendKAS(operatorSeed, recipientAddress, amount);


      console.log(`[VaultService] ✅ On-chain redemption complete. TXID: ${txId}`);


      return {
        success: true,
        txId
      };
    } catch (error: any) {
      console.error('[VaultService] Escrow Redemption Error:', error);
      return {
        success: false,
        error: error?.message || 'Network rejected transaction or insufficient vault funds.'
      };
    }
  }
};


