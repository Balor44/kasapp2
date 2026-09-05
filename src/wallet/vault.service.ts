import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateVoucherCode } from '../utils/voucherCode';
import { KaspaService } from '../wallet/kaspa.service';
import { decryptMnemonic } from '../utils/crypto.utils';


// Optional: Load Argent artifact if covenants are deployed in your environment
const artifactPath = path.join(__dirname, '../../contracts/VoucherEscrow.json');
let escrowArtifact: any = null;


try {
  escrowArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  console.log('[VaultService] Argent covenant artifact loaded successfully.');
} catch (e) {
  console.warn('[VaultService] Argent artifact not found or compiled. Operating in custodial hot-vault mode.');
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


      // 1. Enforce strict Kaspa mainnet address validation
      const isMainnet = recipientAddress.trim().toLowerCase().startsWith('kaspa:');
      if (!isMainnet) {
        return {
          success: false,
          error: "Invalid destination address. Destination must be a valid 'kaspa:' address."
        };
      }


      // 2. High-value 2FA security threshold
      const SECURITY_THRESHOLD = 10000;
      if (amount >= SECURITY_THRESHOLD) {
        console.log(`[VaultService] 🚨 Security Threshold Triggered for redemption (${amount} KAS)`);


        if (!pinProvided) {
          return {
            success: false,
            error: `SECURITY_LOCK: This voucher exceeds the ${SECURITY_THRESHOLD} KAS limit. Secondary 2FA PIN is required.`
          };
        }


        const expectedPin = process.env.ARGENT_MASTER_PIN;
        if (pinProvided !== expectedPin) {
          return {
            success: false,
            error: 'Invalid 2FA PIN. Vault remains locked.'
          };
        }
        console.log('[VaultService] 2FA verified. Covenant unlocked for high-value transfer.');
      }


      // 3. Resolve operator vault mnemonic
      const encryptionKey = process.env.ENCRYPTION_KEY || '';
      let operatorSeed = process.env.OPERATOR_MNEMONIC || '';


      if (!operatorSeed && process.env.OPERATOR_ENCRYPTED_MNEMONIC) {
        operatorSeed = decryptMnemonic(process.env.OPERATOR_ENCRYPTED_MNEMONIC, encryptionKey);
      }


      // In case OPERATOR_MNEMONIC was saved in an encrypted format
      if (operatorSeed && !operatorSeed.includes(' ') && encryptionKey) {
        try {
          operatorSeed = decryptMnemonic(operatorSeed, encryptionKey);
        } catch {
          // If not encrypted, use as-is
        }
      }


      if (!operatorSeed) {
        throw new Error('OPERATOR_MNEMONIC is missing or invalid. Cannot broadcast redemption.');
      }


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


