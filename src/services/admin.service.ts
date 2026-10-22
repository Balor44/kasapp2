import { UserModel } from '../models/User';
import { SubscriptionModel, SubscriptionStatus } from '../models/Subscription';
import { KaspaService } from '../wallet/kaspa.service';
import { userBalanceSompi, formatBalance } from '../utils/balance';
import { kasToSompi, formatKas } from '../utils/sompi';
import { sendFromUser } from './payments';
import { engine } from './ops';
import { runWithMessage } from '../utils/requestContext';


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
      const totalUserSompi = allUsers.reduce((sum: bigint, user: any) => sum + userBalanceSompi(user), 0n);


      const adminUser = await UserModel.findOne({ phone: ADMIN_PHONE });
      const adminBalanceText = adminUser ? formatBalance(adminUser) : '0.0000';


      return (
        `📊 *Kasapp Admin Dashboard*\n\n` +
        `👥 *Total Users:* ${totalUsers}\n` +
        `🔄 *Active Auto-Renewals:* ${activeSubs}\n` +
        `💰 *Global User TVL:* ${formatKas(totalUserSompi)} KAS\n\n` +
        `🏦 *Admin Revenue Balance:* ${adminBalanceText} KAS`
      );
    }


    // --- /admin withdraw [cold_wallet_address] [amount] ---
    if (command === 'withdraw') {
      const targetAddress = parts[2];
      let amountSompi: bigint;
      try { amountSompi = kasToSompi(parts[3]); } catch { return `Usage: /admin withdraw [kaspa_address] [amount]`; }
      if (!targetAddress) return `Usage: /admin withdraw [kaspa_address] [amount]`;

      const adminUser = await UserModel.findOne({ phone });
      if (!adminUser || userBalanceSompi(adminUser) < amountSompi) {
        return `❌ Insufficient admin balance. You only have ${adminUser ? formatBalance(adminUser) : '0.0000'} KAS available to withdraw.`;
      }

      // Logged payout: restores the balance only if the transfer is proven not to have left.
      const outcome = await sendFromUser(adminUser, targetAddress, formatKas(amountSompi, 8));
      if (outcome.status === 'REJECTED') return `❌ *Withdrawal Failed:* ${outcome.message || outcome.reason}`;
      if (outcome.status === 'PENDING') return `⏳ Withdrawal submitted and being confirmed. It will not be sent twice.`;

      const after = await UserModel.findById(adminUser._id);
      return (
        `✅ *Revenue Safely Withdrawn!*\n\n` +
        `• *Sent:* ${formatKas(amountSompi)} KAS to cold storage\n` +
        `• *TXID:* \`${outcome.op.txids[outcome.op.txids.length - 1]}\`\n\n` +
        `🏦 *Remaining Revenue:* ${formatBalance(after || adminUser)} KAS`
      );
    }


    // --- /admin sweep [amount] : move operator hot wallet funds above the reserve to cold storage ---
    if (command === 'sweep') {
      const cold = (process.env.COLD_WALLET_ADDRESS || '').trim();
      const operator = (process.env.OPERATOR_WALLET_ADDRESS || '').trim();
      if (!cold || !operator) return '❌ COLD_WALLET_ADDRESS or OPERATOR_WALLET_ADDRESS is not configured.';
      let amountSompi: bigint;
      try { amountSompi = kasToSompi(parts[2]); } catch { return 'Usage: /admin sweep [amount]'; }

      const reserve = kasToSompi(process.env.OPERATOR_MIN_RESERVE_KAS || '0');
      const balance = await KaspaService.getBalanceSompi(operator);
      if (balance - amountSompi < reserve) {
        return `❌ That would leave the hot wallet below its reserve of ${formatKas(reserve)} KAS. Balance: ${formatKas(balance)} KAS.`;
      }
      const key = `sweep:${Date.now()}`;
      const op = await engine.execute(key, 'PAYOUT', {
        fromWallet: 'operator', fromAddress: operator, toAddress: cold, amountSompi: amountSompi.toString(),
      });
      return op.state === 'CONFIRMED'
        ? `✅ Swept ${formatKas(amountSompi)} KAS to cold storage.\nTXID: \`${op.txids[op.txids.length - 1]}\``
        : op.state === 'FAILED' ? `❌ Sweep failed: ${op.lastError}` : `⏳ Sweep submitted (${op.state}). Check again shortly.`;
    }


    return `⚙️ *Admin Commands:*\n• /admin stats\n• /admin withdraw [address] [amount]\n• /admin sweep [amount]`;
  }
};