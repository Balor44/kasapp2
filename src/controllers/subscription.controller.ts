import { SubscriptionModel, SubscriptionFrequency, SubscriptionStatus } from '../models/Subscription';
import { calculateNextDueDate } from '../utils/date.utils';


export async function handleRecurringMenu(userPhone: string, text: string, userState: any): Promise<string> {
  const input = text.trim().toUpperCase();


  if (userState.step === 'SUB_MENU') {
    switch (input) {
      case '1':
        userState.step = 'SELECT_CATEGORY';
        return `🔄 *Create Auto-Renewal*\n\nSelect category:\n1️⃣ Electricity\n2️⃣ Airtime & Data\n3️⃣ Cable TV\n0️⃣ Back to Main Menu`;
      
      case '2':
        return await handleViewSubscriptions(userPhone);


      case '3':
        return await handleInitiateCancel(userPhone, userState);


      case '0':
        userState.step = 'MAIN_MENU';
        return `Main menu:\n1️⃣ Redeem Voucher\n2️⃣ Pay Utilities\n3️⃣ Auto-Renewals`;


      default:
        return `Invalid option. Reply 1 to Create, 2 to View, 3 to Cancel, or 0 for Back.`;
    }
  }


  if (userState.step === 'SELECT_CATEGORY') {
    const categories: Record<string, string> = { '1': 'ELECTRICITY', '2': 'AIRTIME', '3': 'CABLE' };
    if (!categories[input]) return `Please select 1, 2, or 3.`;


    userState.draftSub = { billerCategory: categories[input] };
    userState.step = 'INPUT_ACCOUNT';
    return `Enter the Account/Meter/Card Number for this service:`;
  }


  if (userState.step === 'INPUT_ACCOUNT') {
    userState.draftSub.accountNumber = input;
    userState.step = 'INPUT_AMOUNT';
    return `Enter the amount in KAS for each renewal (e.g., 10):`;
  }


  if (userState.step === 'INPUT_AMOUNT') {
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) return `Enter a valid positive number for KAS amount.`;


    userState.draftSub.amountKas = amount;
    userState.step = 'SELECT_FREQUENCY';
    return `Select frequency:\n1️⃣ Monthly\n2️⃣ Weekly\n3️⃣ Daily`;
  }


  if (userState.step === 'SELECT_FREQUENCY') {
    const freqs: Record<string, SubscriptionFrequency> = {
      '1': SubscriptionFrequency.MONTHLY,
      '2': SubscriptionFrequency.WEEKLY,
      '3': SubscriptionFrequency.DAILY
    };
    if (!freqs[input]) return `Select 1 for Monthly, 2 for Weekly, or 3 for Daily.`;


    userState.draftSub.frequency = freqs[input];
    userState.step = 'CONFIRM_SUB';


    return `📋 *Confirm Subscription:*
• Service: ${userState.draftSub.billerCategory}
• Account: ${userState.draftSub.accountNumber}
• Amount: ${userState.draftSub.amountKas} KAS
• Frequency: ${userState.draftSub.frequency}


Reply *YES* to activate or *NO* to cancel.`;
  }


  if (userState.step === 'CONFIRM_SUB') {
    if (input === 'YES') {
      const nextDueDate = calculateNextDueDate(new Date(), userState.draftSub.frequency);
      
      await SubscriptionModel.create({
        userPhone,
        billerCategory: userState.draftSub.billerCategory,
        billerCode: userState.draftSub.billerCategory,
        accountNumber: userState.draftSub.accountNumber,
        amountKas: userState.draftSub.amountKas,
        frequency: userState.draftSub.frequency,
        status: SubscriptionStatus.ACTIVE,
        nextDueDate
      });


      userState.step = 'SUB_MENU';
      delete userState.draftSub;
      return `✅ *Auto-renewal active!* Next run: ${nextDueDate.toLocaleDateString()}`;
    } else {
      userState.step = 'SUB_MENU';
      delete userState.draftSub;
      return `❌ Subscription creation cancelled.`;
    }
  }


  if (userState.step === 'SELECT_SUB_TO_CANCEL') {
    const index = parseInt(input) - 1;
    if (isNaN(index) || !userState.cancelList || !userState.cancelList[index]) {
      return `Invalid selection. Please enter a valid number from the list.`;
    }


    userState.cancelSubId = userState.cancelList[index];
    userState.step = 'CONFIRM_CANCEL';
    delete userState.cancelList;
    return `⚠️ Are you sure you want to cancel this auto-renewal?\n\nReply *CONFIRM* to cancel.`;
  }


  if (userState.step === 'CONFIRM_CANCEL') {
    if (input === 'CONFIRM') {
      await SubscriptionModel.findByIdAndUpdate(userState.cancelSubId, {
        status: SubscriptionStatus.CANCELLED
      });
      userState.step = 'SUB_MENU';
      delete userState.cancelSubId;
      return `🗑️ *Subscription successfully cancelled.*`;
    } else {
      userState.step = 'SUB_MENU';
      delete userState.cancelSubId;
      return `Cancellation aborted.`;
    }
  }


  return `Invalid command. Reply 0 to go back to the menu.`;
}


async function handleViewSubscriptions(userPhone: string): Promise<string> {
  const subs = await SubscriptionModel.find({
    userPhone,
    status: SubscriptionStatus.ACTIVE
  });


  if (subs.length === 0) {
    return `You have no active auto-renewals.\n\nReply 1 to create one, or 0 for main menu.`;
  }


  let text = `📋 *Your Active Auto-Renewals:*\n\n`;
  subs.forEach((sub, i) => {
    text += `${i + 1}️⃣ *${sub.billerCategory}* (${sub.accountNumber})\n`;
    text += `   • ${sub.amountKas} KAS | ${sub.frequency}\n`;
    text += `   • Next run: ${sub.nextDueDate.toLocaleDateString()}\n\n`;
  });


  text += `Reply 0 to return to menu.`;
  return text;
}


async function handleInitiateCancel(userPhone: string, userState: any): Promise<string> {
  const subs = await SubscriptionModel.find({
    userPhone,
    status: SubscriptionStatus.ACTIVE
  });


  if (subs.length === 0) {
    return `You have no active subscriptions to cancel.`;
  }


  userState.cancelList = subs.map(s => s._id);
  userState.step = 'SELECT_SUB_TO_CANCEL';


  let text = `🗑️ *Select a subscription to cancel:*\n\n`;
  subs.forEach((sub, i) => {
    text += `${i + 1}️⃣ ${sub.billerCategory} (${sub.accountNumber}) — ${sub.amountKas} KAS\n`;
  });


  return text;
}


