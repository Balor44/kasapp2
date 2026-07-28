"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
function normalizePhone(phone) {
    // Strip any non-digit characters first
    let cleaned = phone.replace(/\D/g, '');
    // If it starts with Nigeria's country code (234) and has more than 10 digits after, convert to local format
    if (cleaned.startsWith('234') && cleaned.length === 13) {
        cleaned = '0' + cleaned.slice(3);
    }
    return cleaned;
}
