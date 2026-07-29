export interface UserState {
  step: string;
  draftSub?: any;
  cancelList?: any[];
  cancelSubId?: string;
}


// In-memory store for WhatsApp conversation states
const stateStore = new Map<string, UserState>();


export async function getUserState(phone: string): Promise<UserState> {
  if (!stateStore.has(phone)) {
    stateStore.set(phone, { step: 'MAIN_MENU' });
  }
  return stateStore.get(phone)!;
}


export async function saveUserState(phone: string, state: UserState): Promise<void> {
  stateStore.set(phone, state);
}


