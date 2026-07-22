function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export interface GeneratedCard {
  code: string;
  amount: number;
}

export function generateCards(kasAmount: number, quantity: number): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  for (let i = 0; i < quantity; i++) {
    cards.push({ code: generateCode(), amount: kasAmount });
  }
  return cards;
}