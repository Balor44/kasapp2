import { VaultService } from './src/wallet/vault.service';

async function run() {
  console.log('1. Creating Voucher for 50 KAS...');
  // Using a dummy 24-word Kaspa testnet mnemonic
  const fakeMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  
  const creation = await VaultService.createVoucherEscrow(fakeMnemonic, 50);
  console.log(creation);

  if (creation.success && creation.voucherCode) {
    console.log('\n2. Redeeming Voucher Code:', creation.voucherCode);
    const redemption = await VaultService.redeemVoucherEscrow(
      'kaspatest:qqdummyrecipientaddress', 
      creation.vaultAddress!, 
      creation.voucherCode
    );
    console.log(redemption);
  }
}

run();