import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addressMatchesNetwork,
  addressPrefixFor,
  isValidNetworkName,
  networksMatch,
  normalizeNetworkId,
} from '../utils/network';

describe('network helpers', () => {
  it('normalises node reported ids', () => {
    assert.equal(normalizeNetworkId(' Mainnet '), 'mainnet');
    assert.equal(normalizeNetworkId('kaspa-mainnet'), 'mainnet');
    assert.equal(normalizeNetworkId('testnet-10'), 'testnet-10');
  });

  it('matches only identical networks', () => {
    assert.equal(networksMatch('mainnet', 'mainnet'), true);
    assert.equal(networksMatch('mainnet', 'kaspa-mainnet'), true);
    assert.equal(networksMatch('mainnet', 'testnet-10'), false);
    assert.equal(networksMatch('testnet-10', 'testnet-11'), false);
    assert.equal(networksMatch('', ''), false);
  });

  it('validates configured names', () => {
    assert.equal(isValidNetworkName('mainnet'), true);
    assert.equal(isValidNetworkName('testnet-10'), true);
    assert.equal(isValidNetworkName('main-net'), false);
    assert.equal(isValidNetworkName('testnet'), false);
    assert.equal(isValidNetworkName(''), false);
  });

  it('uses the correct address prefix per network', () => {
    assert.equal(addressPrefixFor('mainnet'), 'kaspa');
    assert.equal(addressPrefixFor('testnet-10'), 'kaspatest');
    assert.equal(addressMatchesNetwork('kaspa:qqabc', 'mainnet'), true);
    assert.equal(addressMatchesNetwork('kaspatest:qqabc', 'mainnet'), false);
    assert.equal(addressMatchesNetwork('kaspa:qqabc', 'testnet-10'), false);
    assert.equal(addressMatchesNetwork('kaspatest:qqabc', 'testnet-10'), true);
    assert.equal(addressMatchesNetwork('', 'mainnet'), false);
  });
});
