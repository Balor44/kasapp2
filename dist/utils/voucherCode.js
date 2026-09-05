"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoucherCode = generateVoucherCode;
exports.normalizeVoucherCode = normalizeVoucherCode;
const crypto_1 = __importDefault(require("crypto"));
// Excludes visually confusing characters: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/**
 * Generates a random voucher code in the format KASP-XXXX-XXXX-XXXX-XXXX
 * Uses cryptographically secure randomness.
 */
function generateVoucherCode() {
    const segments = [];
    // Generate 4 segments of 4 characters each
    for (let i = 0; i < 4; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            const randomIndex = crypto_1.default.randomInt(0, ALPHABET.length);
            segment += ALPHABET[randomIndex];
        }
        segments.push(segment);
    }
    // Don't forget the closing backtick!
    return `KASP-${segments.join('-')}`;
}
/**
 * Reconstructs a canonical code from whatever a user actually typed.
 */
function normalizeVoucherCode(input) {
    // 1. Strip whitespace, uppercase, AND remove markdown all at once
    const cleaned = input.trim().toUpperCase().replace(/[*_~]/g, '');
    // 2. Now check if it has the prefix
    if (cleaned.startsWith('KASP-')) {
        return cleaned;
    }
    // 3. Prepend if missing
    return `KASP-${cleaned}`;
}
