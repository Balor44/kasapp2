import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../utils/envCheck';

const good = () => ({
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://app:s3cr3t@cluster0.example.mongodb.net/kasapp',
  ENCRYPTION_KEY: 'f3a9c1d27b8e4a5f90d1c6b2e7a48d03',
  ADMIN_API_KEY: 'k9Zr2mQxV7pLw4TnB8cYd1HsJ6eUa3Gf',
  MERCHANT_API_KEY: 'm4Qw8ZxN2vLp7TcB9rYd3HsK6eUa1GfJ',
  ARGENT_MASTER_PIN: '73914826',
  KASPA_NETWORK: 'mainnet',
  OPERATOR_WALLET_ADDRESS: 'kaspa:qqexampleaddress',
  OPERATOR_WALLET_MNEMONIC: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu',
  WHATSAPP_APP_SECRET: 'app-secret-value',
  PAYSTACK_SECRET_KEY: 'sk_live_abc123',
  FLUTTERWAVE_SECRET_KEY: 'FLWSECK-live-abc',
  VTPASS_BASE_URL: 'https://vtpass.com/api',
  CORS_ORIGINS: 'https://mykasapp.com',
  MAX_SEND_KAS_PER_DAY: '1000',
});

describe('validateEnvironment', () => {
  it('passes a strong, complete configuration with no warnings', () => {
    const report = validateEnvironment(good());
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
  });

  it('fails on missing required values', () => {
    const env: any = good();
    delete env.ENCRYPTION_KEY;
    delete env.MONGODB_URI;
    const report = validateEnvironment(env);
    assert.ok(report.errors.some((e) => e.includes('ENCRYPTION_KEY')));
    assert.ok(report.errors.some((e) => e.includes('MONGODB_URI')));
  });

  it('fails on the placeholders shipped in .env.example', () => {
    const env: any = {
      ...good(),
      ENCRYPTION_KEY: 'your_32_byte_aes_256_key_here',
      ADMIN_API_KEY: 'your_admin_api_key_here',
      MERCHANT_API_KEY: 'your_merchant_api_key_here',
      OPERATOR_WALLET_MNEMONIC: 'your_12_word_operator_seed_phrase',
      OPERATOR_WALLET_ADDRESS: 'kaspa:your_operator_wallet_address',
      MONGODB_URI: 'mongodb+srv://<user>:<password>@cluster.mongodb.net/kasapp',
    };
    const report = validateEnvironment(env);
    for (const name of ['ENCRYPTION_KEY', 'ADMIN_API_KEY', 'MERCHANT_API_KEY', 'MONGODB_URI', 'OPERATOR_WALLET_ADDRESS']) {
      assert.ok(report.errors.some((e) => e.includes(name)), `expected an error for ${name}`);
    }
    assert.ok(report.errors.some((e) => e.toLowerCase().includes('operator wallet seed')));
  });

  it('rejects weak 2FA PINs such as the old 1234 default', () => {
    for (const pin of ['1234', '0000', '123456']) {
      const report = validateEnvironment({ ...good(), ARGENT_MASTER_PIN: pin });
      assert.ok(report.errors.some((e) => e.includes('ARGENT_MASTER_PIN')), `PIN ${pin} should be rejected`);
    }
  });

  it('only warns about a short ENCRYPTION_KEY, so existing wallets are never locked out', () => {
    const report = validateEnvironment({ ...good(), ENCRYPTION_KEY: 'short-but-real-key' });
    assert.deepEqual(report.errors, []);
    assert.ok(report.warnings.some((w) => w.includes('ENCRYPTION_KEY')));
  });

  it('rejects an unknown network and an address from the wrong network', () => {
    assert.ok(validateEnvironment({ ...good(), KASPA_NETWORK: 'main' }).errors.some((e) => e.includes('KASPA_NETWORK')));
    const mismatch = validateEnvironment({ ...good(), OPERATOR_WALLET_ADDRESS: 'kaspatest:qqabc' });
    assert.ok(mismatch.errors.some((e) => e.includes('OPERATOR_WALLET_ADDRESS')));
  });

  it('warns about test keys, sandbox VTpass and open CORS on mainnet', () => {
    const report = validateEnvironment({
      ...good(),
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-abc',
      VTPASS_BASE_URL: 'https://sandbox.vtpass.com/api',
      CORS_ORIGINS: '',
    });
    assert.deepEqual(report.errors, []);
    for (const name of ['PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'VTPASS_BASE_URL', 'CORS_ORIGINS']) {
      assert.ok(report.warnings.some((w) => w.includes(name)), `expected a warning for ${name}`);
    }
  });

  it('refuses to run on a testnet with live payment provider settings', () => {
    const testnet: any = {
      ...good(),
      KASPA_NETWORK: 'testnet-10',
      OPERATOR_WALLET_ADDRESS: 'kaspatest:qqexampleaddress',
    };
    const report = validateEnvironment(testnet);
    for (const name of ['VTPASS_BASE_URL', 'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY']) {
      assert.ok(report.errors.some((e) => e.includes(name)), `expected an error for ${name}`);
    }
  });

  it('accepts a testnet run that uses sandbox and test settings', () => {
    const report = validateEnvironment({
      ...good(),
      KASPA_NETWORK: 'testnet-10',
      OPERATOR_WALLET_ADDRESS: 'kaspatest:qqexampleaddress',
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-abc',
      VTPASS_BASE_URL: 'https://sandbox.vtpass.com/api',
    });
    assert.deepEqual(report.errors, []);
  });

  it('does not block mainnet because of the testnet rule', () => {
    const report = validateEnvironment(good());
    assert.deepEqual(report.errors, []);
  });

  it('never prints secret values in messages', () => {
    const env: any = { ...good(), ARGENT_MASTER_PIN: '1234', ENCRYPTION_KEY: 'your_secret_placeholder' };
    const text = JSON.stringify(validateEnvironment(env));
    assert.ok(!text.includes('your_secret_placeholder'));
    assert.ok(!text.includes('"1234"'));
  });

  it('rejects a cold wallet on the wrong network and bad limit values, and warns without a daily limit', () => {
    const wrong: any = { ...good(), COLD_WALLET_ADDRESS: 'kaspatest:qqcold' };
    assert.ok(validateEnvironment(wrong).errors.some((e) => e.includes('COLD_WALLET_ADDRESS')));
    const bad: any = { ...good(), MAX_SEND_KAS_PER_TX: 'lots' };
    assert.ok(validateEnvironment(bad).errors.some((e) => e.includes('MAX_SEND_KAS_PER_TX')));
    const none: any = good();
    delete none.MAX_SEND_KAS_PER_DAY;
    assert.ok(validateEnvironment(none).warnings.some((w) => w.includes('MAX_SEND_KAS_PER_DAY')));
  });
});
