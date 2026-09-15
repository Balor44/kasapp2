import cron from 'node-cron';
import { SubscriptionModel, SubscriptionStatus, SubscriptionFrequency } from '../models/Subscription';
import { UserModel } from '../models/User';
import { BillPayService, BillPayResponse } from '../services/billpay.service';
import { sendWhatsAppNotification } from '../services/whatsapp.service';
import { getKASPriceInNaira } from '../utils/price';
import { redisClient } from '../services/userState.service';
import { KaspaService } from '../wallet/kaspa.service';
import { decryptMnemonic } from '../utils/crypto.utils';


export function calculateNextDueDate(currentDate: Date, frequency: SubscriptionFrequency): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case SubscriptionFrequency.DAILY:
      next.setDate(next.getDate() + 1);
      break;
    case SubscriptionFrequency.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case SubscriptionFrequency.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}


/**
 * Executes the live VTPass/Provider API call based on the subscription category.
 */
async function executeUtilityBillPayment(
  category: string,
  billerCode: string,
  accountNumber: string,
  amountKas: number
): Promise<BillPayResponse> {
 
  const currentRate = await getKASPriceInNaira();
  const amountNaira = Math.floor(amountKas * currentRate * 0.95);


  console.log(`[BILL API] Executing ${billerCode} for ${accountNumber} worth ${amountKas} KAS (₦${amountNaira})`);


  switch (category.toUpperCase()) {
    case 'ELECTRICITY':
      return await BillPayService.payElectricity(accountNumber, amountNaira, billerCode);
    case 'AIRTIME':
      return await BillPayService.buyAirtime(accountNumber, amountNaira, billerCode);
    case 'CABLE':
      return await BillPayService.payCable(accountNumber, amountNaira, billerCode);
    default:
      return { success: false, message: `❌ Unsupported subscription category: ${category}` };
  }
}


/**
 * Processes all due subscriptions securely.
 */
export async function processRecurringSubscriptions(): Promise<void> {
  // 🛡️ 1. GLOBAL RUN-LOCK: Prevents multiple servers from running the cron simultaneously
  const lockKey = 'kasapp:cron:recurring_lock';
  const isLocked = await redisClient.set(lockKey, 'locked', 'EX', 300, 'NX'); // Lock for 5 minutes
  
  if (!isLocked) {
    console.log('[CRON] Another server instance is already running the billing cycle. Skipping.');
    return;
  }


  console.log('[CRON] Starting recurring subscriptions run...');
  const now = new Date();


  try {
    const dueSubscriptions = await SubscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      nextDueDate: { $lte: now },
    });


    console.log(`[CRON] Found ${dueSubscriptions.length} due subscriptions.`);


    for (const sub of dueSubscriptions) {
      try {
        // 🛡️ 2. ATOMIC PER-SUBSCRIPTION CLAIM
        // We push the due date to the year 2099 *before* doing any work. 
        // This acts as a lock. Even if the Redis lock fails, no other worker can grab this sub.
        const lockedSub = await SubscriptionModel.findOneAndUpdate(
          { _id: sub._id, status: SubscriptionStatus.ACTIVE, nextDueDate: { $lte: now } },
          { $set: { nextDueDate: new Date('2099-12-31T00:00:00Z') } },
          { new: true }
        );


        if (!lockedSub) continue; // Another worker already claimed it!


        const user = await UserModel.findOne({ phone: sub.userPhone });
        
        if (!user || user.balance < sub.amountKas) {
          lockedSub.consecutiveFailures += 1;
          lockedSub.status = lockedSub.consecutiveFailures >= 3 ? SubscriptionStatus.FAILED_INSUFFICIENT_FUNDS : SubscriptionStatus.ACTIVE;
          
          // Retry tomorrow if not fully failed
          if (lockedSub.status === SubscriptionStatus.ACTIVE) {
             lockedSub.nextDueDate = calculateNextDueDate(now, SubscriptionFrequency.DAILY); 
          }
          await lockedSub.save();


          await sendWhatsAppNotification(
            sub.userPhone,
            `⚠️ *Auto-Renewal Failed*\n\nYour scheduled payment of *${sub.amountKas} KAS* for ${sub.billerCode} (${sub.accountNumber}) failed due to insufficient funds.\n\nPlease top up your wallet!${lockedSub.consecutiveFailures >= 3 ? ' This subscription has been paused.' : ''}`
          );
          continue;
        }


        // 🛡️ 3. ACTUAL ON-CHAIN DEDUCTION
        // The funds must physically move to the operator wallet to cover the Naira spent
        let txResult: any = { success: false };
        try {
          const operatorWallet = process.env.OPERATOR_WALLET_ADDRESS || '';
          if (!operatorWallet) throw new Error("Operator wallet configuration missing.");
          
          txResult = await KaspaService.sendExternalTransaction(user.mnemonic, operatorWallet, sub.amountKas);
        } catch (e: any) {
          txResult = { success: false, error: e.message };
        }


        if (!txResult.success) {
           // Blockchain failure. Rollback the claim lock to try again tomorrow.
           lockedSub.nextDueDate = calculateNextDueDate(now, SubscriptionFrequency.DAILY);
           await lockedSub.save();
           console.error(`[CRON] On-chain deduction failed for ${sub.userPhone}:`, txResult.error);
           continue; 
        }


        // Sync DB cache only after blockchain success
        user.balance -= sub.amountKas;
        await user.save();


        // 4. Execute Bill Payment via Live API
        const billResult = await executeUtilityBillPayment(
          sub.billerCategory,
          sub.billerCode,
          sub.accountNumber,
          sub.amountKas
        );


        if (billResult.success) {
          // Success! Set the real next due date
          lockedSub.nextDueDate = calculateNextDueDate(now, sub.frequency);
          lockedSub.lastRunAt = now;
          lockedSub.consecutiveFailures = 0;
          await lockedSub.save();


          await sendWhatsAppNotification(
            sub.userPhone,
            `✅ *Auto-Renewal Successful!*\n\n${billResult.message}\n\n💳 *New Balance:* ${user.balance.toFixed(4)} KAS`
          );
        } else {
          // 🛡️ 5. AUTO-REFUND ON VTPASS FAILURE
          try {
              const encryptionKey = process.env.ENCRYPTION_KEY || '';
              let operatorSeed = process.env.OPERATOR_MNEMONIC || '';
              if (!operatorSeed && process.env.OPERATOR_ENCRYPTED_MNEMONIC) {
                  operatorSeed = decryptMnemonic(process.env.OPERATOR_ENCRYPTED_MNEMONIC, encryptionKey);
              }
              await KaspaService.sendKAS(operatorSeed, user.walletAddress || '', sub.amountKas);
              
              user.balance += sub.amountKas;
              await user.save();
          } catch (refundError) {
              console.error(`[FATAL CRON REFUND] Failed to refund ${sub.userPhone}:`, refundError);
          }


          lockedSub.consecutiveFailures += 1;
          lockedSub.nextDueDate = calculateNextDueDate(now, SubscriptionFrequency.DAILY); // Try again tomorrow
          await lockedSub.save();


          await sendWhatsAppNotification(
            sub.userPhone,
            `❌ *Auto-Renewal Failed*\n\nWe couldn't process your ${sub.billerCode} payment right now. The provider might be down. \n\nYour *${sub.amountKas} KAS* has been instantly refunded to your wallet.\n\n_Reason: ${billResult.message}_`
          );
        }
      } catch (err) {
        console.error(`[CRON ERROR] Failed processing sub ID ${sub._id}:`, err);
      }
    }
  } finally {
    // Release the master run-lock when the cron is totally finished
    await redisClient.del(lockKey);
  }


  console.log('[CRON] Completed recurring payments run.');
}


// Schedule to run every day at 08:00 AM WAT
export function initRecurringPaymentsCron(): void {
  cron.schedule('0 8 * * *', async () => {
    await processRecurringSubscriptions();
  });
  console.log('[CRON INITIALIZED] Recurring payments schedule set for 08:00 AM daily.');
}


