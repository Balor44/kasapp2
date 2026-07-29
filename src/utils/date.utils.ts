import { SubscriptionFrequency } from '../models/Subscription';


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


