/**
 * Kaspa network helpers. Pure functions, no dependencies, so they can be unit tested.
 */

export class NetworkMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkMismatchError';
  }
}

export function normalizeNetworkId(id: string): string {
  return String(id || '').trim().toLowerCase().replace(/^kaspa-/, '');
}

export function isValidNetworkName(id: string): boolean {
  return /^(mainnet|testnet-\d+)$/.test(normalizeNetworkId(id));
}

/** True when the network the app is configured for equals the network the node reports. */
export function networksMatch(configured: string, reported: string): boolean {
  const a = normalizeNetworkId(configured);
  const b = normalizeNetworkId(reported);
  return a !== '' && a === b;
}

export function addressPrefixFor(network: string): string {
  const n = normalizeNetworkId(network);
  if (n === 'mainnet') return 'kaspa';
  if (n.startsWith('testnet')) return 'kaspatest';
  if (n.startsWith('devnet')) return 'kaspadev';
  if (n.startsWith('simnet')) return 'kaspasim';
  return 'kaspa';
}

export function addressMatchesNetwork(address: string, network: string): boolean {
  return String(address || '').trim().toLowerCase().startsWith(addressPrefixFor(network) + ':');
}
