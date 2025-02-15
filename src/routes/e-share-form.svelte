<script lang="ts">
	import { enhance } from '$app/forms';
	import { dexie } from '$lib/dexie';
	import { encrypt } from '$lib/encryption';
	import {
		seedFiles,
		METADATA_FILENAME,
		CONTENT_FILENAME,
		setupExpiryTimeout
	} from '$lib/webtorrent';
	import { generateSlug } from 'random-word-slugs';
	import type { EShare } from '$lib/dexie';
	import { Modal, Label, Input, Textarea, Fileupload, Toggle, Button } from 'flowbite-svelte';
	import toast from 'svelte-french-toast';

	let { showModal = $bindable(false), onClose = () => {} } = $props();

	let name = $state('');
	let url = $state('');
	let file = $state<File | null>(null);
	let description = $state('');
	let notes = $state('');
	let withPassword = $state(false);
	let password = $state('');
	let selfDestruct = $state(false);
	let withExpiry = $state(false);
	let expiresAt = $state(new Date());
	let showSuccessModal = $state(false);
	let shareLink = $state('');

	const resetForm = () => {
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
		showModal = false;
		onClose();
	};

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(shareLink);
		toast.success('Link copied to clipboard');
	};
</script>

<Modal
	bind:open={showModal}
	size="lg"
	autoclose={false}
	class="mt-[5vh] max-h-[32rem] w-full md:max-h-auto"
>
	<form
		id="eshareform"
		class="m-auto max-h-full space-y-4 overflow-y-auto"
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

			newLink = {
				...newLink,
				nonce
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
			const metadataFile = new File([metadataBlob], METADATA_FILENAME, {
				type: 'application/json'
			});
			const contentFile = new File([contentBlob], CONTENT_FILENAME, { type: contentBlob.type });

			const { shareLink: newShareLink, magnetURI } = await seedFiles(
				metadataFile,
				contentFile,
				id,
				selfDestruct
			);

			// Set up expiry timeout if needed
			if (withExpiry) {
				setupExpiryTimeout(newLink);
			}

			// Update the link with the shortened magnet URI
			await dexie.magnets.add({
				id: crypto.randomUUID(),
				eshareId: id,
				shortMagnet: newShareLink,
				magnet: magnetURI
			});

			// Show success modal with share details
			shareLink = newShareLink;
			showModal = false;
			showSuccessModal = true;
			await copyToClipboard();

			resetForm();
			cancel();
		}}
	>
		<h3 class="text-center text-2xl">(shh)are new data</h3>
		<div class="space-y-4 p-4">
			<div>
				<Label for="name">Name (optional)</Label>
				<Input id="name" name="name" type="text" bind:value={name} />
			</div>

			<div>
				<Label for="url">URL</Label>
				<Input
					id="url"
					name="url"
					type="url"
					required={!file}
					placeholder="https://www.topsecret.com"
					bind:value={url}
					disabled={!!file}
					on:input={() => {
						if (url) file = null;
					}}
				/>
			</div>

			<div>
				<Label for="file">Or upload a file</Label>
				<Fileupload
					id="file"
					name="file"
					required={!url}
					disabled={!!url}
					on:change={(e) => {
						const files = (e.currentTarget as any)?.files;
						if (files && files.length > 0) {
							file = files[0];
							url = '';
						}
					}}
				/>
			</div>

			<div>
				<Label for="description">Description (optional)</Label>
				<Input id="description" name="description" type="text" bind:value={description} />
			</div>

			<div>
				<Label for="notes">Notes (optional)</Label>
				<Textarea id="notes" name="notes" rows={3} bind:value={notes} />
			</div>

			<div class="space-y-2">
				<Toggle bind:checked={withPassword}>Password Protection</Toggle>
				{#if withPassword}
					<div>
						<Label for="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							required={withPassword}
							bind:value={password}
						/>
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<Toggle bind:checked={withExpiry}>Set Expiry</Toggle>
				{#if withExpiry}
					<div>
						<Label for="expiresAt">Expiry Date</Label>
						<Input
							id="expiresAt"
							name="expiresAt"
							type="datetime-local"
							required={withExpiry}
							bind:value={expiresAt}
						/>
					</div>
				{/if}
			</div>

			<div class="hidden space-y-2">
				<Toggle bind:checked={selfDestruct}>
					{selfDestruct ? 'Self Destruct!' : 'Self Destruct?'}
				</Toggle>
				<input name="selfDestruct" type="hidden" value={selfDestruct} />
			</div>
		</div>
	</form>
	<svelte:fragment slot="footer">
		<Button type="submit" color="green" form="eshareform">(shh)are it</Button>
		<Button color="red" on:click={resetForm}>Cancel</Button>
	</svelte:fragment>
</Modal>

<Modal bind:open={showSuccessModal} size="md" autoclose={false} class="w-full">
	<div class="p-4 text-center">
		<h3 class="mb-4 text-xl font-medium">Share Created Successfully!</h3>
		<p class="mb-4">Your shareable link:</p>
		<div class="mb-4 flex items-center justify-center gap-2">
			<code class="overflow-auto rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{shareLink}</code>
			<Button size="xs" color="purple" on:click={copyToClipboard}>Copy</Button>
		</div>
		<Button color="green" on:click={() => (showSuccessModal = false)}>Done</Button>
	</div>
</Modal>
