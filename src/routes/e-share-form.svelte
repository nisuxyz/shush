<script lang="ts">
	import Timepicker from '$lib/components/timepicker.svelte';
	import Toggle from 'svelte-toggle';
	import { enhance } from '$app/forms';
	import { dexie } from '$lib/dexie';
	import { encrypt } from '$lib/encryption';
	import { seedFiles, METADATA_FILENAME, CONTENT_FILENAME, setupExpiryTimeout } from '$lib/webtorrent';
	import { generateSlug } from 'random-word-slugs';
	import type { EShare } from '$lib/dexie';

	let name = $state('');
	let url = $state('');
	let file: File | null = $state(null);
	let description = $state('');
	let notes = $state('');
	let withPassword = $state(false);
	let password = $state('');
	let selfDestruct = $state(false);
	let withExpiry = $state(false);
	let expiresAt = $state(new Date());
</script>

<form
	class="flex flex-col p-4"
	method="POST"
	enctype="multipart/form-data"
	use:enhance={async ({ formData, cancel }) => {
		const urlInput = formData.get('url');
		const fileInput = formData.get('file') as File | null;
		const expiry = formData.get('expiresAt');
		const id = crypto.randomUUID();

		// Create metadata
		let newLink: EShare = {
			id,
			name: fileInput ? fileInput.name : (formData.get('name') as string) || generateSlug(4),
			description: formData.get('description') as string,
			notes: formData.get('notes') as string,
			...(expiry ? { expiresAt: new Date(expiresAt) } : {}),
			type: fileInput ? 'file' : 'url',
			encrypted: withPassword,
			enabled: true,
			selfDestruct
		};

		// Handle content
		let contentBlob: Blob;
		let nonce: string | undefined;

		if (fileInput) {
			if (withPassword) {
				const encrypted = await encrypt(fileInput, password);
				contentBlob = encrypted.blob;
				nonce = encrypted.nonce;
			} else {
				contentBlob = new Blob([await fileInput.arrayBuffer()], { type: fileInput.type });
			}
		} else {
			const data = urlInput as string;
			if (withPassword) {
				const encrypted = await encrypt(data, password);
				contentBlob = encrypted.blob;
				nonce = encrypted.nonce;
			} else {
				contentBlob = new Blob([data], { type: 'text/plain' });
			}
		}

		console.log({nonce});

		newLink = {
			...newLink,
			nonce // Store the base64 string directly
		};

		// Store metadata and content
		await dexie.links.add(newLink);
		await dexie.content.add({
			id: crypto.randomUUID(),
			eshareId: id,
			blob: contentBlob
		});

		// Create torrent files
		const metadataBlob = new Blob([JSON.stringify(newLink)], { type: 'application/json' });
		const metadataFile = new File([metadataBlob], METADATA_FILENAME, { type: 'application/json' });
		const contentFile = new File([contentBlob], CONTENT_FILENAME, { type: contentBlob.type });

		const { shareLink, magnetURI } = await seedFiles(metadataFile, contentFile, id, selfDestruct);
		
		// Set up expiry timeout if needed
		if (withExpiry) {
			setupExpiryTimeout(newLink);
		}

		// Update the link with the shortened magnet URI
		await dexie.magnets.add({
			id: crypto.randomUUID(),
			eshareId: id,
			shortMagnet: shareLink,
			magnet: magnetURI
		});

		// Create and display the shareable link
		alert(`Your shareable link: ${shareLink}`);

		// Reset form
		name = '';
		url = '';
		file = null;
		description = '';
		notes = '';
		withPassword = false;
		password = '';
		selfDestruct = false;
		withExpiry = false;
		expiresAt = new Date();

		cancel();
	}}
>
	<div>
		<h1 class="text-center text-3xl font-semibold text-white">shush</h1>
    <h2 class="mb-8 text-xl text-center text-gray-400">simple & private data sharing</h2>
		<div class="flex flex-col">
			<label for="name" class="text-gray-300">name (optional)</label>
			<input
				name="name"
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white dark:bg-white dark:text-gray-900"
				type="text"
				bind:value={name}
			/>
		</div>
		<div class="flex flex-col">
			<label for="url" class="text-gray-300">url</label>
			<input
				name="url"
				required={!file}
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white dark:bg-white dark:text-gray-900"
				type="url"
				placeholder="https://www.topsecret.com"
				bind:value={url}
				disabled={!!file}
				oninput={() => {
					if (url) file = null;
				}}
			/>
		</div>
		<div class="flex flex-col">
			<label for="file" class="text-gray-300">or upload a file</label>
			<input
				name="file"
				type="file"
				required={!url}
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white file:mr-4 file:rounded-full file:border-0 file:bg-gray-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700"
				disabled={!!url}
				onchange={(e) => {
					const files = e.currentTarget.files;
					if (files && files.length > 0) {
						file = files[0];
						url = '';
					}
				}}
			/>
		</div>
		<div class="flex flex-col">
			<label for="description" class="text-gray-300">description (optional)</label>
			<input
				name="description"
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white dark:bg-white dark:text-gray-900"
				type="text"
				bind:value={description}
			/>
		</div>
		<div class="flex flex-col">
			<label for="notes" class="text-gray-300">notes (optional)</label>
			<textarea
				name="notes"
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white dark:bg-white dark:text-gray-900"
				bind:value={notes}
			>
			</textarea>
		</div>
		<div class="flex flex-col">
			<Toggle
				toggled={withPassword}
				class="mt-1"
				label=""
				toggledColor="red"
				on:toggle={(e) => (withPassword = e.detail)}
			/>
			<label for="password" class="text-gray-300">password</label>
			<input
				id="password"
				name="password"
				required={withPassword}
				class="rounded-sm border border-1 bg-gray-600 p-1 text-white dark:bg-white dark:text-gray-900"
				type="password"
				bind:value={password}
				disabled={!withPassword}
			/>
		</div>
		<div class="flex flex-col">
			<Toggle
				toggled={withExpiry}
				class="mt-1"
				label=""
				toggledColor="red"
				on:toggle={(e) => (withExpiry = e.detail)}
			/>
			<label for="expiresAt" class="flex text-gray-300">expire?</label>
			<!-- <input name="expiresAt" class="border border-1 rounded-sm p-1 bg-gray-600 text-white dark:text-gray-900 dark:bg-white" type="url" bind:value={link} /> -->
			<Timepicker
				name="expiresAt"
				disabled={!withExpiry}
				required={!!withExpiry}
				bind:startDate={expiresAt}
			/>
		</div>
		<div class="mt-2 flex flex-col hidden">
			<Toggle
				toggled={selfDestruct}
				class="mt-1"
				label=""
				toggledColor="red"
				on:toggle={(e) => (selfDestruct = e.detail)}
			/>
			<label
				for="selfDestruct"
				class="flex"
				class:text-gray-300={!selfDestruct}
				class:text-red-400={selfDestruct}
			>
				self {selfDestruct ? 'destruct!' : 'destruct?'}
			</label>
			<input name="selfDestruct" class="hidden" value={selfDestruct} disabled={!selfDestruct} />
		</div>
		<br />
	</div>
	<button
		class="rounded border border-gray-700 bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700"
		type="submit">(shh)are it</button
	>
</form>

<style>
	#password:disabled,
	input:disabled {
		background: lightgray;
	}
</style>
