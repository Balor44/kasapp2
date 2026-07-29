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
 * Generates a random voucher code in the format XXXX-XXXX-XXXX (12 chars, grouped).
 * Uses crypto.randomInt for cryptographically secure randomness — voucher codes
 * are effectively bearer cash, so they must not be predictable or brute-forceable.
 */
function generateVoucherCode() {
    let raw = '';
    for (let i = 0; i < 12; i++) {
        raw += ALPHABET[crypto_1.default.randomInt(0, ALPHABET.length)];
    }
    return raw.match(/.{1,4}/g).join('-');
}
/**
 * Reconstructs a canonical XXXX-XXXX-XXXX code from whatever a user actually typed.
 * Strips anything that isn't a letter or digit — handles missing hyphens, stray
 * spaces, and mobile keyboards that autocorrect "-" into an en dash or similar —
 * then re-groups and re-hyphenates to match the stored format exactly.
 */
function normalizeVoucherCode(input) {
    if (!input || typeof input !== 'string')
        return '';
    const stripped = input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const grouped = stripped.match(/.{1,4}/g);
    return grouped ? grouped.join('-') : stripped;
}
