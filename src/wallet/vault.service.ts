import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateVoucherCode } from '../utils/voucherCode';
import { Mnemonic, PrivateKey } from '@dfns/kaspa-wasm';


// Load the compiled Argent artifact
const artifactPath = path.join(__dirname, '../../contracts/VoucherEscrow.json');
let escrowArtifact: any = null;


try {
  escrowArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  console.log('[VaultService] Argent covenant artifact loaded successfully.');
} catch (e) {
  console.warn('[VaultService] Artifact not found. Ensure argent compilation succeeded.');
}


export const VaultService = {
  
  async createVoucherEscrow(
    senderMnemonic: string, 
    amountKas: number
  ): Promise<{ success: boolean; voucherCode?: string; vaultAddress?: string; txId?: string; error?: string }> {
    try {
      if (!escrowArtifact) throw new Error('Covenant artifact missing.');


      // Validates WASM imports without crashing the secp256k1 curve
      const mnemonic = new Mnemonic(senderMnemonic);
      const masterSeedHex = mnemonic.toSeed('');
      
      // PrivateKey strictly requires a 32-byte (64-char) hex string.
      // In production, you would use XPrv derivation (m/44'/111111'/0'/0/0).
      // For now, we slice the master seed to 64 chars to satisfy the validator.
      const privateKey = new PrivateKey(masterSeedHex.substring(0, 64));


      const raw = crypto.randomBytes(16).toString('hex'); // 32-char hex
      const secretCode = generateVoucherCode();
      const codeHash = crypto.createHash('sha256').update(secretCode).digest('hex');

      console.log(`[VaultService] Binding Argent covenant creation using bytecode length: ${escrowArtifact.bytecode?.length || 0}`);
      
      const simulatedVaultAddress = 'kaspa:argent_escrow_' + codeHash.substring(0, 10);
      
      return { 
        success: true, 
        voucherCode: secretCode, 
        vaultAddress: simulatedVaultAddress, 
        txId: 'simulated_fund_tx_' + crypto.randomBytes(4).toString('hex') 
      };
    } catch (error: any) {
      console.error('[VaultService] Escrow Creation Error:', error);
      return { success: false, error: error.message };
    }
  },


  async redeemVoucherEscrow(
  recipientAddress: string,
  vaultAddress: string,
  secretCode: string,
  amount: number,           
  pinProvided?: string      
) {
  try {
    if (!escrowArtifact) throw new Error('Covenant artifact missing.');

    console.log(`[VaultService] Attempting Argent transition 'redeem' for vault ${vaultAddress} (${amount} KAS)`);

    // --- THE 10k KAS SECURITY LOCK ---
    const SECURITY_THRESHOLD = 10000;

    if (amount >= SECURITY_THRESHOLD) {
      console.log(`[VaultService] 🚨 Security Threshold Triggered for vault ${vaultAddress}`);
      
      if (!pinProvided) {
        return {
          success: false,
          error: `SECURITY_LOCK: This voucher exceeds the ${SECURITY_THRESHOLD} KAS limit. Secondary 2FA PIN is required to unlock this covenant.`
        };
      }

      // Verify the PIN (You can hash this or compare against a db record later)
      const expectedPin = process.env.ARGENT_MASTER_PIN;
      if (pinProvided !== expectedPin) {
        return {
          success: false,
          error: "Invalid 2FA PIN. Covenant remains locked."
        };
      }
      console.log(`[VaultService] 2FA verified. Covenant unlocked for high-value transfer.`);
    }

    return {
      success: true,
      txId: 'simulated_redeem_tx_' + crypto.randomBytes(4).toString('hex')
    };
  } catch (error: any) {
    console.error('[VaultService] Escrow Redemption Error:', error);
    return { success: false, error: 'Network rejected transition. Invalid code.' };
  }
  }
};