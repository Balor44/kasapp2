import { UserModel } from "../models/User";
import { KaspaService } from "../wallet/kaspa.service";

/**
 * The only place new users are created. The seed is encrypted before it is stored, always.
 * Returns null when the phone already has a wallet.
 */
export async function provisionUser(phone: string) {
  const existing = await UserModel.findOne({ phone });
  if (existing) return null;
  const { address, encryptedSeed } = await KaspaService.createEncryptedWallet();
  return UserModel.create({
    phone,
    wallet: address,
    walletAddress: address,
    mnemonic: encryptedSeed,
    balance: 0,
    balanceSompi: "0",
  });
}
