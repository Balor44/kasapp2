import { UserModel } from '../models/User';
import { SubscriptionModel, SubscriptionStatus } from '../models/Subscription';
import { KaspaService } from '../wallet/kaspa.service';


// Set this in your Railway Environment Variables to your personal E.164 number (e.g., +234...)
const ADMIN_PHONE = process.env.ADMIN_PHONE || ''; 


export const AdminService = {
  isAdmin: (phone: string): boolean => {
    return phone === ADMIN_PHONE;
  },


  processCommand: async (phone: string, text: string): Promise<string> => {
    const parts = text.trim().split(' ');
    const command = parts[1]?.toLowerCase();


    // --- /admin stats ---
    if (command === 'stats') {
      const totalUsers = await UserModel.countDocuments();
      const activeSubs = await SubscriptionModel.countDocuments({ status: SubscriptionStatus.ACTIVE });
      
      const allUsers = await UserModel.find({});
      const totalUserBalance = allUsers.reduce((sum, user) => sum + user.balance, 0);


      const adminUser = await UserModel.findOne({ phone: ADMIN_PHONE });
      const adminBalance = adminUser?.balance || 0;


      return (
        `📊 *Kasapp Admin Dashboard*\n\n` +
        `👥 *Total Users:* ${totalUsers}\n` +
        `🔄 *Active Auto-Renewals:* ${activeSubs}\n` +
        `💰 *Global User TVL:* ${totalUserBalance.toFixed(4)} KAS\n\n` +
        `🏦 *Admin Revenue Balance:* ${adminBalance.toFixed(4)} KAS`
      );
    }


    // --- /admin withdraw [cold_wallet_address] [amount] ---
    if (command === 'withdraw') {
      const targetAddress = parts[2];
      const amount = parseFloat(parts[3]);


      if (!targetAddress || isNaN(amount) || amount <= 0) {
        return `Usage: /admin withdraw [kaspa_address] [amount]`;
      }


      const adminUser = await UserModel.findOne({ phone });
      
      if (!adminUser || adminUser.balance < amount) {
        return `❌ Insufficient admin balance. You only have ${adminUser?.balance || 0} KAS available to withdraw.`;
      }


      // Execute on-chain withdrawal to your hardware wallet / external exchange
      const txResult = await KaspaService.sendExternalTransaction(adminUser.mnemonic, targetAddress, amount);


      if (!txResult.success) {
        return `❌ *Withdrawal Failed:* ${txResult.error}`;
      }


      adminUser.balance -= amount;
      await adminUser.save();


      return (
        `✅ *Revenue Safely Withdrawn!*\n\n` +
        `• *Sent:* ${amount} KAS to cold storage\n` +
        `• *TXID:* \`${txResult.txId}\`\n\n` +
        `🏦 *Remaining Revenue:* ${adminUser.balance.toFixed(4)} KAS`
      );
    }


    return `⚙️ *Admin Commands:*\n• /admin stats\n• /admin withdraw [address] [amount]`;
  }
};