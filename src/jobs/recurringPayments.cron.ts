import cron from 'node-cron';
import { SubscriptionModel, SubscriptionStatus, SubscriptionFrequency } from '../models/Subscription';
import { UserModel } from '../models/User';
import { BillPayService, BillPayResponse } from '../services/billpay.service';
import { sendWhatsAppNotification } from '../services/whatsapp.service';
import { getKASPriceInNaira } from '../utils/price';
import { redisClient } from '../services/userState.service';
import { KaspaService } from '../wallet/kaspa.service';
import { acquireLock, releaseLock } from '../utils/lock';
import { runWithMessage } from '../utils/requestContext';
import { payBillFromUser } from '../services/payments';
import { userBalanceSompi, formatBalance } from '../utils/balance';
import { kasToSompi } from '../utils/sompi';


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
  const lockToken = await acquireLock(redisClient as any, lockKey, 600_000); // token safe, 10 minutes

  if (!lockToken) {
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
        
        if (!user || userBalanceSompi(user) < kasToSompi(sub.amountKas)) {
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


        // 3. PAY. One stable key per subscription per billing cycle, so a crash, a restart or a second
        // worker can never charge or buy twice. The payment, the provider call and any refund are
        // logged operations (see services/payments.ts).
        const cycleKey = `cron:${sub._id}:${new Date(sub.nextDueDate).getTime()}`;
        const currentRate = await getKASPriceInNaira();
        const amountNaira = Math.floor(sub.amountKas * currentRate * 0.95);
        const kind = ({ ELECTRICITY: 'electricity', AIRTIME: 'airtime', CABLE: 'cable' } as Record<string, string>)[String(sub.billerCategory).toUpperCase()];
        if (!kind) {
          lockedSub.status = SubscriptionStatus.FAILED_INSUFFICIENT_FUNDS;
          await lockedSub.save();
          continue;
        }

        const outcome = await runWithMessage(cycleKey, () =>
          payBillFromUser(user, sub.amountKas, {
            provider: 'FLUTTERWAVE', kind, target: sub.accountNumber, network: sub.billerCode, amountNaira,
          })
        );

        if (outcome.status === 'DONE') {
          lockedSub.nextDueDate = calculateNextDueDate(now, sub.frequency);
          lockedSub.lastRunAt = now;
          lockedSub.consecutiveFailures = 0;
          await lockedSub.save();
          const fresh = await UserModel.findById(user._id);
          await sendWhatsAppNotification(
            sub.userPhone,
            `✅ *Auto-Renewal Successful!*\n\n${sub.billerCode} (${sub.accountNumber}) paid.\n\n💳 *New Balance:* ${formatBalance(fresh || user)} KAS`
          );
        } else if (outcome.status === 'PENDING') {
          // Outcome not known yet. The reconciler settles it and refunds automatically on proven failure.
          lockedSub.nextDueDate = calculateNextDueDate(now, sub.frequency);
          lockedSub.lastRunAt = now;
          await lockedSub.save();
          await sendWhatsAppNotification(sub.userPhone, `⏳ Your ${sub.billerCode} renewal is being confirmed. You will not be charged twice.`);
        } else {
          lockedSub.consecutiveFailures += 1;
          lockedSub.nextDueDate = calculateNextDueDate(now, SubscriptionFrequency.DAILY); // try again tomorrow
          await lockedSub.save();
          await sendWhatsAppNotification(
            sub.userPhone,
            outcome.reason === 'INSUFFICIENT'
              ? `⚠️ *Auto-Renewal Failed*\n\nNot enough balance for your ${sub.billerCode} renewal. Please top up your wallet.`
              : `❌ *Auto-Renewal Failed*\n\nWe couldn't process your ${sub.billerCode} payment right now. Any KAS taken has been returned to your wallet.`
          );
        }
      } catch (err) {
        console.error(`[CRON ERROR] Failed processing sub ID ${sub._id}:`, err);
      }
    }
  } finally {
    // Release the master run-lock when the cron is totally finished
    await releaseLock(redisClient as any, lockKey, lockToken);
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


