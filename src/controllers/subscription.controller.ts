import { SubscriptionModel, SubscriptionFrequency, SubscriptionStatus } from '../models/Subscription';
import { calculateNextDueDate } from '../utils/date.utils';


export async function handleRecurringMenu(userPhone: string, text: string, userState: any): Promise<string> {
  const input = text.trim().toUpperCase();


  // 1. WELCOME / LANDING SCREEN (Triggered on /auto or returning to sub main)
  if (userState.step === 'SUB_WELCOME') {
    // If they typed an option directly from welcome screen, route it immediately
    if (input === '1') {
      userState.step = 'SELECT_CATEGORY';
      return `🔄 *Create a New Auto-Renewal*\n\nWhich service would you like to set up on autopilot?\n\n1️⃣ Electricity Bills\n2️⃣ Airtime & Data\n3️⃣ Cable TV (DSTV, GOTV, StarTimes)\n0️⃣ Back to Main Menu`;
    }
    if (input === '2') {
      return await handleViewSubscriptions(userPhone);
    }
    if (input === '3') {
      return await handleInitiateCancel(userPhone, userState);
    }
    if (input === '0') {
      userState.step = 'MAIN_MENU';
      return `Returned to main menu. Type /help to see all available commands!`;
    }


    // Default welcome message when they first launch /auto
    userState.step = 'SUB_WELCOME';
    return `Welcome to **Kasapp Auto-Renewals**! 🤖⚡\n\nNever get caught with disconnected power, expired TV subscriptions, or zero data again. Set up automatic payments using your KAS wallet, and we'll handle your bills on schedule.\n\n*What would you like to do today?*\n\n1️⃣ *Create Auto-Renewal* — Set up automated payments for Electricity, Airtime, or Cable TV.\n2️⃣ *View Active Subscriptions* — See your scheduled payments and upcoming due dates.\n3️⃣ *Cancel a Subscription* — Stop an active auto-renewal anytime.\n0️⃣ *Back to Main Menu*\n\n_Reply with a number (1, 2, 3, or 0) to select an option._`;
  }


  // 2. CATEGORY SELECTION
  if (userState.step === 'SELECT_CATEGORY') {
    if (input === '0') {
      userState.step = 'SUB_WELCOME';
      return await handleRecurringMenu(userPhone, '', userState);
    }


    const categories: Record<string, string> = { '1': 'ELECTRICITY', '2': 'AIRTIME', '3': 'CABLE' };
    if (!categories[input]) {
      return `Please pick a valid option:\n1️⃣ Electricity\n2️⃣ Airtime & Data\n3️⃣ Cable TV\n0️⃣ Back`;
    }


    userState.draftSub = { billerCategory: categories[input] };
    userState.step = 'INPUT_ACCOUNT';
    
    const accountPrompts: Record<string, string> = {
      ELECTRICITY: 'Please enter your **Meter Number** (e.g. 1234567890):',
      AIRTIME: 'Please enter the **Phone Number** to receive top-ups:',
      CABLE: 'Please enter your **SmartCard or IUC Number**:'
    };


    return `Got it! ${accountPrompts[categories[input]]}`;
  }


  // 3. ACCOUNT NUMBER INPUT
  if (userState.step === 'INPUT_ACCOUNT') {
    userState.draftSub.accountNumber = input;
    userState.step = 'INPUT_AMOUNT';
    return `Great. How much **KAS** would you like to allocate for each renewal?\n\n_(Example: Reply 15 to spend 15 KAS every cycle)_`;
  }


  // 4. AMOUNT INPUT
  if (userState.step === 'INPUT_AMOUNT') {
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return `That amount doesn't look quite right — please enter a positive number for your KAS amount (e.g. 10).`;
    }


    userState.draftSub.amountKas = amount;
    userState.step = 'SELECT_FREQUENCY';
    return `How frequently should we process this payment?\n\n1️⃣ **Monthly** (Every 30 days)\n2️⃣ **Weekly** (Every 7 days)\n3️⃣ **Daily** (Every 24 hours)`;
  }


  // 5. FREQUENCY SELECTION
  if (userState.step === 'SELECT_FREQUENCY') {
    const freqs: Record<string, SubscriptionFrequency> = {
      '1': SubscriptionFrequency.MONTHLY,
      '2': SubscriptionFrequency.WEEKLY,
      '3': SubscriptionFrequency.DAILY
    };
    if (!freqs[input]) {
      return `Please reply with:\n1️⃣ for Monthly\n2️⃣ for Weekly\n3️⃣ for Daily`;
    }


    userState.draftSub.frequency = freqs[input];
    userState.step = 'CONFIRM_SUB';


    return `📋 *Please confirm your Auto-Renewal setup:*\n\n• **Service:** ${userState.draftSub.billerCategory}\n• **Account/Meter:** ${userState.draftSub.accountNumber}\n• **Recurring Amount:** ${userState.draftSub.amountKas} KAS\n• **Frequency:** ${userState.draftSub.frequency}\n\nReply *YES* to activate this subscription, or *NO* to cancel.`;
  }


  // 6. CONFIRMATION
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


      userState.step = 'SUB_WELCOME';
      delete userState.draftSub;
      return `🎉 *Auto-Renewal Active!*\n\nWe've scheduled your first payment for **${nextDueDate.toLocaleDateString()}**. As long as you keep sufficient KAS in your wallet, we'll keep your service running smooth on autopilot!\n\nType /auto anytime to manage your subscriptions.`;
    } else {
      userState.step = 'SUB_WELCOME';
      delete userState.draftSub;
      return `❌ Subscription setup cancelled. No funds were deducted.\n\nType /auto to return to the auto-renewal menu.`;
    }
  }


  // 7. SELECTION FOR CANCELLATION
  if (userState.step === 'SELECT_SUB_TO_CANCEL') {
    if (input === '0') {
      userState.step = 'SUB_WELCOME';
      delete userState.cancelList;
      return await handleRecurringMenu(userPhone, '', userState);
    }


    const index = parseInt(input) - 1;
    if (isNaN(index) || !userState.cancelList || !userState.cancelList[index]) {
      return `Invalid selection. Please enter the number corresponding to the subscription you want to cancel (or reply 0 to exit).`;
    }


    userState.cancelSubId = userState.cancelList[index];
    userState.step = 'CONFIRM_CANCEL';
    delete userState.cancelList;
    return `⚠️ *Confirm Cancellation*\n\nAre you sure you want to stop this auto-renewal? Once cancelled, you will need to pay manually or set up a new schedule.\n\nReply *CONFIRM* to stop auto-renewal, or *NO* to keep it.`;
  }


  // 8. CANCELLATION CONFIRMATION
  if (userState.step === 'CONFIRM_CANCEL') {
    if (input === 'CONFIRM') {
      await SubscriptionModel.findByIdAndUpdate(userState.cancelSubId, {
        status: SubscriptionStatus.CANCELLED
      });
      userState.step = 'SUB_WELCOME';
      delete userState.cancelSubId;
      return `🗑️ *Subscription Cancelled.*\n\nWe have stopped automated payments for this account. You can set up a new one anytime using /auto.`;
    } else {
      userState.step = 'SUB_WELCOME';
      delete userState.cancelSubId;
      return `Cancellation aborted. Your subscription remains active!`;
    }
  }


  // Fallback to welcome screen
  userState.step = 'SUB_WELCOME';
  return await handleRecurringMenu(userPhone, '', userState);
}


async function handleViewSubscriptions(userPhone: string): Promise<string> {
  const subs = await SubscriptionModel.find({
    userPhone,
    status: SubscriptionStatus.ACTIVE
  });


  if (subs.length === 0) {
    return `📋 *Your Active Auto-Renewals*\n\nYou don't have any active automated payments right now.\n\nReply *1* to create your first auto-renewal, or type /auto to go back.`;
  }


  let text = `📋 *Your Active Auto-Renewals:*\n\n`;
  subs.forEach((sub, i) => {
    text += `${i + 1}️⃣ *${sub.billerCategory}* (${sub.accountNumber})\n`;
    text += `   • **Amount:** ${sub.amountKas} KAS | **Frequency:** ${sub.frequency}\n`;
    text += `   • **Next Payment:** ${sub.nextDueDate.toLocaleDateString()}\n\n`;
  });


  text += `Reply *3* to cancel a subscription, or *0* to return to the menu.`;
  return text;
}


async function handleInitiateCancel(userPhone: string, userState: any): Promise<string> {
  const subs = await SubscriptionModel.find({
    userPhone,
    status: SubscriptionStatus.ACTIVE
  });


  if (subs.length === 0) {
    return `You don't have any active subscriptions to cancel.\n\nType /auto to return to the main auto-renewal menu.`;
  }


  userState.cancelList = subs.map(s => s._id);
  userState.step = 'SELECT_SUB_TO_CANCEL';


  let text = `🗑️ *Cancel an Auto-Renewal*\n\nSelect the number of the subscription you'd like to stop:\n\n`;
  subs.forEach((sub, i) => {
    text += `${i + 1}️⃣ ${sub.billerCategory} (${sub.accountNumber}) — ${sub.amountKas} KAS\n`;
  });


  text += `\nReply with the number (e.g. 1) or reply *0* to go back.`;
  return text;
}


