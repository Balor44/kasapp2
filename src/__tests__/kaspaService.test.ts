import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshRequire, installMocks, pkg } from './helpers/loader';

const PHRASE = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
const ENV_KEYS = ['KASPA_NETWORK', 'ENCRYPTION_KEY'];

interface Scenario {
  nodeNetwork?: string;
  isSynced?: boolean;
  connectFails?: boolean;
  utxoFails?: boolean;
  entries?: any[];
}

function makeKaspa(scenario: Scenario) {
  const calls = { connect: [] as any[], generator: [] as any[], utxoQueries: 0, disconnects: 0 };

  const rpc = {
    getServerInfo: async () => ({ networkId: scenario.nodeNetwork ?? 'mainnet', isSynced: scenario.isSynced ?? true }),
    getUtxosByAddresses: async () => {
      calls.utxoQueries++;
      if (scenario.utxoFails) throw new Error('rpc timeout');
      return { entries: scenario.entries ?? [{ amount: 250_000_000n }] };
    },
    disconnect: async () => {
      calls.disconnects++;
    },
  };

  class Resolver {
    async connect(options: any) {
      calls.connect.push(options);
      if (scenario.connectFails) throw new Error('no public node available');
      return rpc;
    }
  }
  class XPrv {
    constructor(_seed: string) {}
    derivePath() {
      return this;
    }
    toPrivateKey() {
      return {
        toKeypair: () => ({
          toAddress: (network: string) => ({ toString: () => (network === 'mainnet' ? 'kaspa:qqsender' : 'kaspatest:qqsender') }),
        }),
      };
    }
  }
  class Generator {
    private finished = false;
    constructor(options: any) {
      calls.generator.push(options);
    }
    async next() {
      if (this.finished) return null;
      this.finished = true;
      return { sign: () => {}, submit: async () => 'tx-abc123' };
    }
  }

  return { calls, module: { Resolver, XPrv, Generator } };
}

describe('KaspaService network safety', () => {
  let restore: () => void;
  const saved: Record<string, string | undefined> = {};

  function load(network: string, scenario: Scenario) {
    process.env.KASPA_NETWORK = network;
    const kaspa = makeKaspa(scenario);
    restore = installMocks([
      pkg('kaspa-wasm', kaspa.module),
      pkg('bip39', { generateMnemonic: () => PHRASE, mnemonicToSeedSync: () => Buffer.from('00', 'hex') }),
      pkg('isomorphic-ws', { __esModule: true, default: class {} }),
    ]);
    const service = freshRequire('wallet/kaspa.service').KaspaService;
    return { service, calls: kaspa.calls };
  }

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.ENCRYPTION_KEY = 'unit-test-encryption-key-0123456789';
  });

  afterEach(() => {
    if (restore) restore();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('passes the network to the resolver as networkId (not network_id)', async () => {
    const { service, calls } = load('mainnet', {});
    const balance = await service.getBalance('kaspa:qqabc');
    assert.equal(balance, 2.5);
    assert.deepEqual(calls.connect[0], { networkId: 'mainnet', encoding: 'borsh' });
    assert.equal('network_id' in calls.connect[0], false);
    assert.equal(calls.disconnects, 1);
  });

  it('refuses to read a balance when the node is on a different network', async () => {
    const { service, calls } = load('mainnet', { nodeNetwork: 'testnet-10' });
    await assert.rejects(service.getBalance('kaspa:qqabc'), /Network mismatch/);
    assert.equal(calls.utxoQueries, 0);
    assert.equal(calls.disconnects, 1);
  });

  it('throws instead of returning 0 when the RPC call fails', async () => {
    const { service } = load('mainnet', { utxoFails: true });
    await assert.rejects(service.getBalance('kaspa:qqabc'), /rpc timeout/);
  });

  it('throws instead of returning 0 when no node can be reached', async () => {
    const { service } = load('mainnet', { connectFails: true });
    await assert.rejects(service.getBalance('kaspa:qqabc'), /no public node available/);
  });

  it('still returns a true zero for an empty wallet', async () => {
    const { service } = load('mainnet', { entries: [] });
    assert.equal(await service.getBalance('kaspa:qqabc'), 0);
  });

  it('verifyNetwork reports a mismatch as NetworkMismatchError and succeeds when networks match', async () => {
    const bad = load('mainnet', { nodeNetwork: 'testnet-10' });
    await assert.rejects(bad.service.verifyNetwork(), (error: any) => error.name === 'NetworkMismatchError');
    restore();

    const good = load('testnet-10', { nodeNetwork: 'testnet-10' });
    assert.equal(await good.service.verifyNetwork(), 'testnet-10');
  });

  it('rejects an invalid amount before touching the network', async () => {
    const { service, calls } = load('mainnet', {});
    for (const bad of [0, -5, NaN, 'abc']) {
      await assert.rejects(service.sendKAS(PHRASE, 'kaspa:qqdest', bad as any), /Invalid transaction amount\./);
    }
    assert.equal(calls.connect.length, 0);
  });

  it('refuses to send while the node is still syncing', async () => {
    const { service, calls } = load('mainnet', { isSynced: false });
    await assert.rejects(service.sendKAS(PHRASE, 'kaspa:qqdest', 1), /still syncing/);
    assert.equal(calls.generator.length, 0);
  });

  it('builds the transaction with the exact sompi amount on the configured network', async () => {
    const { service, calls } = load('mainnet', {});
    const txid = await service.sendKAS(PHRASE, 'kaspa:qqdest', 1.5);
    assert.equal(txid, 'tx-abc123');
    assert.equal(calls.generator.length, 1);
    assert.equal(calls.generator[0].outputs[0].amount, 150_000_000n);
    assert.equal(calls.generator[0].outputs[0].address, 'kaspa:qqdest');
    assert.equal(calls.generator[0].networkId, 'mainnet');
    assert.equal(calls.disconnects, 1);
  });

  it('rejects a destination address from the wrong network without connecting', async () => {
    const mainnet = load('mainnet', {});
    const result = await mainnet.service.sendExternalTransaction(PHRASE, 'kaspatest:qqdest', 1);
    assert.equal(result.success, false);
    assert.equal(result.error, "Invalid address format. Mainnet addresses must start with 'kaspa:'.");
    assert.equal(mainnet.calls.connect.length, 0);
    restore();

    const testnet = load('testnet-10', { nodeNetwork: 'testnet-10' });
    const wrong = await testnet.service.sendExternalTransaction(PHRASE, 'kaspa:qqdest', 1);
    assert.equal(wrong.success, false);
    assert.match(wrong.error, /must start with 'kaspatest:'/);
    const right = await testnet.service.sendExternalTransaction(PHRASE, 'kaspatest:qqdest', 1);
    assert.equal(right.success, true);
    assert.equal(right.txId, 'tx-abc123');
  });
});
