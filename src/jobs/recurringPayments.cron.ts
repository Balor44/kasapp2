import cron from 'node-cron';
import { SubscriptionModel, SubscriptionStatus, SubscriptionFrequency } from '../models/Subscription';
import { UserModel } from '../models/User';


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
 * Placeholder for your utility provider integration (e.g. Vtpass, Flutterwave, etc.)
 */
async function executeUtilityBillPayment(
  category: string,
  billerCode: string,
  accountNumber: string,
  amountKas: number
): Promise<{ success: boolean; transactionReference?: string; error?: string }> {
  // TODO: Connect your actual biller API call here.
  console.log(`[BILL API] Executing ${billerCode} for ${accountNumber} worth ${amountKas} KAS`);
  return { success: true, transactionReference: `TX-${Date.now()}` };
}


/**
 * Placeholder for sending WhatsApp messages to your users
 */
async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  // TODO: Call your WhatsApp bot messaging function here
  console.log(`[WHATSAPP SENT to ${phone}]: ${message}`);
}


/**
 * Processes all due subscriptions.
 */
export async function processRecurringSubscriptions(): Promise<void> {
  console.log('[CRON] Starting recurring subscriptions run...');
  const now = new Date();


  // Find all active subscriptions due today or earlier
  const dueSubscriptions = await SubscriptionModel.find({
    status: SubscriptionStatus.ACTIVE,
    nextDueDate: { $lte: now },
  });


  console.log(`[CRON] Found ${dueSubscriptions.length} due subscriptions.`);


  for (const sub of dueSubscriptions) {
    try {
      // 1. Atomically deduct balance from user if sufficient
      const updatedUser = await UserModel.findOneAndUpdate(
        { phone: sub.userPhone, balance: { $gte: sub.amountKas } },
        { $inc: { balance: -sub.amountKas } },
        { new: true }
      );


      // 2. Handle Insufficient Funds
      if (!updatedUser) {
        sub.consecutiveFailures += 1;
        if (sub.consecutiveFailures >= 3) {
          sub.status = SubscriptionStatus.FAILED_INSUFFICIENT_FUNDS;
        }
        await sub.save();


        await sendWhatsAppMessage(
          sub.userPhone,
          `⚠️ Your recurring payment of ${sub.amountKas} KAS for ${sub.billerCode} (${sub.accountNumber}) failed due to insufficient balance. Please recharge your wallet!`
        );
        continue;
      }


      // 3. Execute Bill Payment via API
      const billResult = await executeUtilityBillPayment(
        sub.billerCategory,
        sub.billerCode,
        sub.accountNumber,
        sub.amountKas
      );


      if (billResult.success) {
        // Payment Succeeded — Update Subscription Schedule
        const nextDate = calculateNextDueDate(now, sub.frequency);
        sub.nextDueDate = nextDate;
        sub.lastRunAt = now;
        sub.consecutiveFailures = 0;
        await sub.save();


        await sendWhatsAppMessage(
          sub.userPhone,
          `✅ Auto-renewal successful! ${sub.amountKas} KAS paid for ${sub.billerCode} (${sub.accountNumber}). Your new balance is ${updatedUser.balance.toFixed(4)} KAS.`
        );
      } else {
        // Bill Provider Error — Refund User Balance & Log Failure
        await UserModel.updateOne(
          { phone: sub.userPhone },
          { $inc: { balance: sub.amountKas } }
        );


        sub.consecutiveFailures += 1;
        await sub.save();


        await sendWhatsAppMessage(
          sub.userPhone,
          `❌ Auto-renewal for ${sub.billerCode} failed on provider side. Your ${sub.amountKas} KAS has been refunded to your wallet balance.`
        );
      }
    } catch (err) {
      console.error(`[CRON ERROR] Failed processing sub ID ${sub._id}:`, err);
    }
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


