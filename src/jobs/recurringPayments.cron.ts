import cron from 'node-cron';
import { SubscriptionModel, SubscriptionStatus, SubscriptionFrequency } from '../models/Subscription';
import { UserModel } from '../models/User';
import { BillPayService, BillPayResponse } from '../services/billpay.service';
import { sendWhatsAppNotification } from '../services/whatsapp.service';
import { getKASPriceInNaira } from '../utils/price';


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
 * Executes the live Flutterwave API call based on the subscription category.
 */
async function executeUtilityBillPayment(
  category: string,
  billerCode: string,
  accountNumber: string,
  amountKas: number
): Promise<BillPayResponse> {
  
  // Convert KAS balance to Naira for the Flutterwave API right when the cron runs
  const currentRate = await getKASPriceInNaira();
  
  // 5% spread protection to account for price volatility since they set up the subscription
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


        await sendWhatsAppNotification(
          sub.userPhone,
          `⚠️ *Auto-Renewal Failed*\n\nYour scheduled payment of *${sub.amountKas} KAS* for ${sub.billerCode} (${sub.accountNumber}) failed due to insufficient funds.\n\nPlease top up your wallet!${sub.consecutiveFailures >= 3 ? ' This subscription has been paused.' : ''}`
        );
        continue;
      }


      // 3. Execute Bill Payment via Live API
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


        // Notify user with success message (which automatically includes prepaid tokens if it's electricity)
        await sendWhatsAppNotification(
          sub.userPhone,
          `✅ *Auto-Renewal Successful!*\n\n${billResult.message}\n\n💳 *New Balance:* ${updatedUser.balance.toFixed(4)} KAS`
        );
      } else {
        // Bill Provider Error — Refund User Balance & Log Failure
        await UserModel.updateOne(
          { phone: sub.userPhone },
          { $inc: { balance: sub.amountKas } }
        );


        sub.consecutiveFailures += 1;
        await sub.save();


        await sendWhatsAppNotification(
          sub.userPhone,
          `❌ *Auto-Renewal Failed*\n\nWe couldn't process your ${sub.billerCode} payment right now. The provider might be down. \n\nYour *${sub.amountKas} KAS* has been instantly refunded to your wallet.\n\n_Reason: ${billResult.message}_`
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