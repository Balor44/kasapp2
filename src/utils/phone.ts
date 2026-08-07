import parsePhoneNumber from 'libphonenumber-js';


/**
 * Normalizes any phone number into full E.164 international format (e.g., +2348012345678 or +12025550123).
 * Defaults to 'NG' (Nigeria) if no country code is provided in the string.
 */
export function normalizePhone(phone: string, defaultCountry: any = 'NG'): string {
  if (!phone) return '';


  try {
    const cleaned = phone.trim();


    // Parse the phone number using libphonenumber-js
    const phoneNumber = parsePhoneNumber(cleaned, defaultCountry);


    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.number; // Returns '+2348012345678' or '+12025550123'
    }


    // Fallback manual sanitization if parsing fails
    let digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      return `+234${digitsOnly.slice(1)}`;
    }
    if (!digitsOnly.startsWith('+')) {
      return `+${digitsOnly}`;
    }


    return digitsOnly;
  } catch {
    // Basic fallback for edge cases
    let digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      return `+234${digitsOnly.slice(1)}`;
    }
    return `+${digitsOnly}`;
  }
}