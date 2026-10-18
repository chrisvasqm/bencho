// Private, loopback and link-local targets. Blocked unless ALLOW_PRIVATE_TARGETS is on, so a
// reachable Bencho cannot be aimed at services on its own network (SSRF).
// This file checks literal hosts before a run starts; k6 checks the resolved IPs of every request.
import { isIPv4, isIPv6 } from 'node:net';

/** Ranges k6 refuses to connect to (K6_BLACKLIST_IPS), checked after DNS resolution. */
export const PRIVATE_IP_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::/128',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
];

/** Hostnames k6 refuses (K6_BLOCK_HOSTNAMES). One leading * is the only wildcard k6 supports. */
export const PRIVATE_HOSTNAMES = ['localhost', '*.localhost', '*.local', '*.internal'];

/** What k6 writes to stderr for a request to a blocked target. */
export const K6_BLOCKED_TARGET_PATTERN = /is in a (blacklisted range|blocked pattern)/;

export const PRIVATE_TARGET_MESSAGE =
  'The target is a private or local address, which this server does not allow.';

/**
 * Returns why `url` may not be a target, or null when its host is allowed. Only a literal
 * private IP or a blocked hostname is caught here; hosts that resolve to a private address
 * are refused by k6 when the run sends its first request. `url` must parse.
 */
export function privateTargetProblem(url: string): string | null {
  // A trailing dot is the fully qualified form of the same name.
  const host = new URL(url).hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  const matchesHostname = PRIVATE_HOSTNAMES.some((pattern) =>
    pattern.startsWith('*') ? host.endsWith(pattern.slice(1)) : host === pattern,
  );
  if (matchesHostname || isPrivateIp(host)) return `${PRIVATE_TARGET_MESSAGE} (${host})`;
  return null;
}

interface Range {
  bits: 32 | 128;
  network: bigint;
  mask: bigint;
}

const RANGES: Range[] = PRIVATE_IP_RANGES.map((range) => {
  const [address = '', prefix = ''] = range.split('/');
  const bits = isIPv4(address) ? 32 : 128;
  return {
    bits,
    network: bits === 32 ? ipv4ToBigInt(address) : ipv6ToBigInt(address),
    mask: (1n << BigInt(bits)) - (1n << BigInt(bits - Number(prefix))),
  };
});

function isPrivateIp(host: string): boolean {
  if (isIPv4(host)) return inRanges(ipv4ToBigInt(host), 32);
  if (!isIPv6(host)) return false;
  const value = ipv6ToBigInt(host);
  // ::ffff:a.b.c.d (URL parsing writes it ::ffff:7f00:1) is an IPv4 address in IPv6 clothing.
  if (value >> 32n === 0xffffn) return inRanges(value & 0xffffffffn, 32);
  return inRanges(value, 128);
}

function inRanges(address: bigint, bits: 32 | 128): boolean {
  return RANGES.some(
    (range) => range.bits === bits && (address & range.mask) === (range.network & range.mask),
  );
}

function ipv4ToBigInt(address: string): bigint {
  return address.split('.').reduce((total, octet) => (total << 8n) + BigInt(octet), 0n);
}

/** Reads the eight 16-bit groups of a canonical IPv6 address (hex groups, one `::` at most). */
function ipv6ToBigInt(address: string): bigint {
  const [head = '', tail = ''] = address.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const zeros = Array<string>(8 - headGroups.length - tailGroups.length).fill('0');
  return [...headGroups, ...zeros, ...tailGroups].reduce(
    (total, group) => (total << 16n) + BigInt(`0x${group}`),
    0n,
  );
}
