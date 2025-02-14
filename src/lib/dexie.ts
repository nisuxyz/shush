import Dexie, { type EntityTable } from 'dexie';

export interface Magnet {
	id: string;
	eshareId: string;
	magnet: string;
	shortMagnet: string;
}

export interface EShare {
	id: string;
	name: string;
	description: string;
	notes?: string;
	expiresAt?: Date;
	type: 'url' | 'file';
	encrypted: boolean;
	nonce?: string;
	enabled: boolean;
	selfDestruct?: boolean;
}

export interface BinaryContent {
	id: string;
	eshareId: string;
	blob: Blob;
}

export interface Auth {
	username: string;
	randEncrypted: ArrayBuffer; // Encrypted random string (validates password)
	randHash: ArrayBuffer; // Optional: Store a hash of the derived key for quick validation
	iv: Uint8Array;
	kdfSalt: Uint8Array;
	lastSignIn: Date; // Timestamp for managing session expiration
}

export const dexie = new Dexie('shush') as Dexie & {
	auth: EntityTable<Auth, 'username'>;
	links: EntityTable<EShare, 'id'>;
	magnets: EntityTable<Magnet, 'id'>;
	content: EntityTable<BinaryContent, 'id'>;
};

dexie.version(3).stores({
	auth: '++username, randEncrypted, randHash, kdfSalt, lastSignIn',
	links: '++id, name, description, notes, expiresAt, type, encrypted, enabled',
	magnets: '++id, eshareId, magnet, shortMagnet',
	content: '++id, eshareId, nonce'
});
