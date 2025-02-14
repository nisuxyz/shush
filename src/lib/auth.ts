import { type Auth, dexie } from '$lib/dexie';
import { writable } from 'svelte/store';
import { resumeSeeding } from './webtorrent';

export const userSaltSessionKey = 'userSalt';
export const userSaltWritable = writable<string | undefined>(undefined);
export const userWritable = writable<Auth | undefined>(undefined);

const arrayBuffersEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean => {
	if (a.byteLength !== b.byteLength) return false;
	const aView = new Uint8Array(a);
	const bView = new Uint8Array(b);
	for (let i = 0; i < aView.length; i++) {
		if (aView[i] !== bView[i]) return false;
	}
	return true;
}


export const createUser = async (username: string, password: string) => {
	const encoder = new TextEncoder();
	const kdfSalt = crypto.getRandomValues(new Uint8Array(16)); // Generate KDF salt

	// Derive a key using the password and KDF salt
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);
	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: kdfSalt,
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);

	const randomString = crypto.getRandomValues(new Uint8Array(16)); // Generate random string

	const iv = crypto.getRandomValues(new Uint8Array(12)); // IV for AES-GCM
	const encryptedRandomString = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		randomString
	);

	const user = {
		username,
		randEncrypted: encryptedRandomString,
		randHash: await crypto.subtle.digest('SHA-256', randomString),
		iv,
		kdfSalt,
		lastSignIn: new Date()
	};

	// Store in IndexedDB
	await dexie.auth.put(user);
};

export const authenticate = async (username: string, password: string) => {
	const encoder = new TextEncoder();
	const authData = await dexie.auth.get(username); // Assuming single row for simplicity

	if (!authData) {
		throw new Error(`User ${username} not found!`);
	}

	const kdfSalt = authData.kdfSalt;

	// Derive key from entered password
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);
	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: kdfSalt,
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['decrypt']
	);

	const encryptedRandomString = authData.randEncrypted;
	const iv = authData.iv;
	const ciphertext = encryptedRandomString; // Rest is the en crypted data

	try {
		const decryptedRandomString = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			key,
			ciphertext
		);

		// Optional: Validate decrypted random string by comparing its hash
		const randomStringHash = await crypto.subtle.digest('SHA-256', decryptedRandomString);
		if (!arrayBuffersEqual(randomStringHash, authData.randHash)) {
			throw new Error('Hash mismatch: possible tampering or wrong password.');
		}

		// Store password in memory for this session
		userSaltWritable.set(password);
		userWritable.set(authData);
		
		// Resume seeding all enabled links
		await resumeSeeding();
		
		return true;
	} catch (error) {
		console.error('Authentication failed:', error);
		return false;
	}
};

export const signOut = async () => {
	userSaltWritable.set(undefined);
}
