import { addressMatchesNetwork, isValidNetworkName, normalizeNetworkId } from './network';

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const PLACEHOLDER_MARKERS = ['your_', 'change_me', 'changeme', 'replace_me', 'xxxx'];
const WEAK_PINS = new Set([
  '1234', '0000', '1111', '4321', '123456', '000000', '111111', '654321', '12345678', 'password',
]);

function value(env: Env, name: string): string {
  return (env[name] || '').trim();
}

function looksLikePlaceholder(text: string): boolean {
  const lower = text.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Checks the environment at startup. Messages name the variable but never print its value.
 * Errors stop the server from starting. Warnings are logged.
 *
 * Note: ENCRYPTION_KEY is only warned about when short, never rejected for length, because
 * changing it would make every stored seed phrase unreadable.
 */
export function validateEnvironment(env: Env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Required ---
  const encryptionKey = value(env, 'ENCRYPTION_KEY');
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY is missing.');
  } else if (looksLikePlaceholder(encryptionKey)) {
    errors.push('ENCRYPTION_KEY still contains a placeholder value from .env.example.');
  } else if (encryptionKey.length < 32) {
    warnings.push('ENCRYPTION_KEY is shorter than 32 characters. Do not change it if wallets already exist, or stored seeds become unreadable.');
  }

  const mongoUri = value(env, 'MONGODB_URI');
  if (!mongoUri) {
    errors.push('MONGODB_URI is missing.');
  } else if (mongoUri.includes('<user>') || mongoUri.includes('<password>')) {
    errors.push('MONGODB_URI still contains the placeholder from .env.example.');
  }

  // --- Network ---
  const network = value(env, 'KASPA_NETWORK') || 'mainnet';
  if (!isValidNetworkName(network)) {
    errors.push('KASPA_NETWORK must be "mainnet" or a testnet such as "testnet-10".');
  }

  // --- Secrets that must not be placeholders or weak ---
  const adminKey = value(env, 'ADMIN_API_KEY');
  if (!adminKey) {
    warnings.push('ADMIN_API_KEY is not set. All admin and merchant API routes will reject every request.');
  } else if (looksLikePlaceholder(adminKey)) {
    errors.push('ADMIN_API_KEY still contains a placeholder value from .env.example.');
  } else if (adminKey.length < 24) {
    warnings.push('ADMIN_API_KEY is shorter than 24 characters.');
  }

  const merchantKey = value(env, 'MERCHANT_API_KEY');
  if (merchantKey && looksLikePlaceholder(merchantKey)) {
    errors.push('MERCHANT_API_KEY still contains a placeholder value from .env.example.');
  } else if (merchantKey && merchantKey.length < 24) {
    warnings.push('MERCHANT_API_KEY is shorter than 24 characters.');
  }

  const pin = value(env, 'ARGENT_MASTER_PIN');
  if (!pin) {
    warnings.push('ARGENT_MASTER_PIN is not set. Vouchers of 10,000 KAS or more cannot be redeemed.');
  } else if (WEAK_PINS.has(pin.toLowerCase()) || looksLikePlaceholder(pin)) {
    errors.push('ARGENT_MASTER_PIN is a weak or placeholder value. Choose a PIN that is not guessable.');
  } else if (pin.length < 6) {
    warnings.push('ARGENT_MASTER_PIN is shorter than 6 characters.');
  }

  // --- Operator wallet ---
  const operatorSeed =
    value(env, 'OPERATOR_WALLET_MNEMONIC') ||
    value(env, 'OPERATOR_MNEMONIC') ||
    value(env, 'OPERATOR_ENCRYPTED_MNEMONIC');
  if (!operatorSeed) {
    warnings.push('No operator wallet seed is configured. Vouchers, bill payments and refunds will fail.');
  } else if (looksLikePlaceholder(operatorSeed)) {
    errors.push('The operator wallet seed still contains a placeholder value from .env.example.');
  }

  const operatorAddress = value(env, 'OPERATOR_WALLET_ADDRESS');
  if (!operatorAddress) {
    warnings.push('OPERATOR_WALLET_ADDRESS is not set. Bill payments and vouchers will fail.');
  } else if (looksLikePlaceholder(operatorAddress)) {
    errors.push('OPERATOR_WALLET_ADDRESS still contains a placeholder value from .env.example.');
  } else if (isValidNetworkName(network) && !addressMatchesNetwork(operatorAddress, network)) {
    errors.push('OPERATOR_WALLET_ADDRESS does not match the configured KASPA_NETWORK.');
  }

  const coldAddress = value(env, 'COLD_WALLET_ADDRESS');
  if (coldAddress && looksLikePlaceholder(coldAddress)) {
    errors.push('COLD_WALLET_ADDRESS still contains a placeholder value.');
  } else if (coldAddress && isValidNetworkName(network) && !addressMatchesNetwork(coldAddress, network)) {
    errors.push('COLD_WALLET_ADDRESS does not match the configured KASPA_NETWORK.');
  }
  for (const name of ['MAX_SEND_KAS_PER_TX', 'MAX_SEND_KAS_PER_DAY', 'OPERATOR_MIN_RESERVE_KAS']) {
    const v = value(env, name);
    if (v && !/^\d+(\.\d{1,8})?$/.test(v)) errors.push(`${name} must be a plain KAS amount such as 500 or 12.5.`);
  }
  if (!value(env, 'MAX_SEND_KAS_PER_DAY')) {
    warnings.push('MAX_SEND_KAS_PER_DAY is not set. A taken over account can be drained in one go. Set a daily send limit.');
  }
  const merchantKeys = value(env, 'MERCHANT_API_KEYS');
  if (merchantKeys && looksLikePlaceholder(merchantKeys)) {
    errors.push('MERCHANT_API_KEYS still contains a placeholder value.');
  }

  // --- Integrations (warnings only) ---
  if (!value(env, 'WHATSAPP_APP_SECRET')) {
    warnings.push('WHATSAPP_APP_SECRET is not set. WhatsApp webhook signature checks will reject every message.');
  }
  if (!value(env, 'PAYSTACK_SECRET_KEY')) {
    warnings.push('PAYSTACK_SECRET_KEY is not set. Paystack payments and webhooks will not work.');
  }
  if (network === 'mainnet') {
    if (value(env, 'PAYSTACK_SECRET_KEY').startsWith('sk_test_')) {
      warnings.push('PAYSTACK_SECRET_KEY is a test key while running on mainnet.');
    }
    if (value(env, 'FLUTTERWAVE_SECRET_KEY').toUpperCase().includes('FLWSECK_TEST')) {
      warnings.push('FLUTTERWAVE_SECRET_KEY is a test key while running on mainnet.');
    }
    if (value(env, 'VTPASS_BASE_URL').includes('sandbox') || !value(env, 'VTPASS_BASE_URL')) {
      warnings.push('VTPASS_BASE_URL points at the VTpass sandbox (or is unset), so utility purchases are simulated.');
    }
  }
  // Testnet coins have no value, so a testnet run must never be wired to live payment providers.
  // Otherwise a test message could spend real Naira from a real provider balance.
  if (isValidNetworkName(network) && normalizeNetworkId(network) !== 'mainnet') {
    const vtpassUrl = value(env, 'VTPASS_BASE_URL');
    if (vtpassUrl && !vtpassUrl.toLowerCase().includes('sandbox')) {
      errors.push('KASPA_NETWORK is a testnet but VTPASS_BASE_URL is the live VTpass API. Use https://sandbox.vtpass.com/api for testing.');
    }
    if (value(env, 'PAYSTACK_SECRET_KEY').toLowerCase().startsWith('sk_live_')) {
      errors.push('KASPA_NETWORK is a testnet but PAYSTACK_SECRET_KEY is a live key. Use a sk_test_ key for testing.');
    }
    if (value(env, 'FLUTTERWAVE_SECRET_KEY').toUpperCase().startsWith('FLWSECK-')) {
      errors.push('KASPA_NETWORK is a testnet but FLUTTERWAVE_SECRET_KEY is a live key. Use a FLWSECK_TEST key for testing.');
    }
  }
  if (!value(env, 'CORS_ORIGINS')) {
    warnings.push('CORS_ORIGINS is not set, so any website can call the public API from a browser.');
  }

  return { errors, warnings };
}
