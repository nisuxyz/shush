import { Buffer } from 'buffer';

import bs58 from 'bs58';
import { MAGNET_TRACKERS, METADATA_FILENAME } from './webtorrent';

// Convert hex string to Base58 to make it shorter
function hexToBase58(hex: string): string {
	const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
	return bs58.encode(bytes);
}

// Generate a short URL from a seeded torrent
export function generateShortLink(magnetURI: string): string {
    // Extract the btih (BitTorrent Info Hash) and name from the magnet URI
    const infoHash = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]+)/);

    if (!infoHash)
        throw new Error('Invalid magnet uri: no btih found');

	const shortHash = hexToBase58(infoHash[1]); // Shorten the hash
	return `${window.location.origin}/s/${shortHash}`; // Example: mysite.com/s/Xyz123
}

export function generateMagnetURI(shortHash: string): string {
    const infoHash = base58ToHex(shortHash);

    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${METADATA_FILENAME}&tr=${MAGNET_TRACKERS}`;

    return magnet;
}

// Convert Base58 back to hex
function base58ToHex(base58: string): string {
	const bytes = bs58.decode(base58);
	return Buffer.from(bytes).toString('hex');
}

// Extract info hash from URL and start download
export function extractInfoHashFromUrl(path: string): string | null {
	const shortHash = path.split('/').pop(); // Get last part of URL
	if (!shortHash) return null;
	return base58ToHex(shortHash);
}
