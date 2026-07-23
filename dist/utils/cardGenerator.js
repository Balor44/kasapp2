"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCards = generateCards;
function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 10; i++)
        code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}
function generateCards(kasAmount, quantity) {
    const cards = [];
    for (let i = 0; i < quantity; i++) {
        cards.push({ code: generateCode(), amount: kasAmount });
    }
    return cards;
}
