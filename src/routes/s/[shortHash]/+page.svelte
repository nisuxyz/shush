<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fetchFile, getTorrent } from '$lib/webtorrent';
	import { generateMagnetURI } from '$lib/utils';
	import { decrypt } from '$lib/encryption';
	import toast from 'svelte-french-toast';
	import type { EShare } from '$lib/dexie';
	import { Card, Button, Input, Label, Progressbar, Spinner } from 'flowbite-svelte';
	import {
		FileOutline,
		LinkOutline,
		InfoCircleOutline,
		MessageCaptionOutline,
		ClockOutline,
		CheckCircleOutline,
		UsersGroupOutline
	} from 'flowbite-svelte-icons';

	function getSafeFileName(blob: Blob, shareData: EShare | null): string {
		// If we have a name from shareData, use it as base
		let fileName = shareData?.name || '';

		// Get the file extension from the MIME type if no extension in name
		const mimeType = blob.type;
		const defaultExt = mimeType ? `.${mimeType.split('/')[1]}` : '';

		if (!fileName) {
			// If no name provided, use a default with the correct extension
			return `downloaded-file${defaultExt}`;
		}

		// Check if the filename already has an extension
		const hasExtension = /\.[a-zA-Z0-9]+$/.test(fileName);
		if (!hasExtension && defaultExt) {
			fileName += defaultExt;
		}

		// Sanitize the filename
		fileName = fileName
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Replace invalid characters
			.replace(/^\.+/, '') // Remove leading dots
			.replace(/\s+/g, '_') // Replace spaces with underscores
			.trim();

		return fileName || `downloaded-file${defaultExt}`;
	}

	const shortHash = page.params.shortHash;
	const magnet = generateMagnetURI(shortHash);

	let password = $state('');
	let error: string | null = $state(null);
	let fetchedHash = $state(false);
	let fetchedMetadata = $state(false);
	let ready = $state(false);
	let progress = $state(0);
	let downloadSpeed = $state(0);
	let timeRemaining = $state(0);
	let connectedPeers = $state(0);
	let shareData = $state<EShare | null>(null);
	let decryptedContent: string | Blob | null = $state(null);
	let contentFile: File | null = $state(null);

	onMount(() => {
		const torrent = getTorrent(magnet);
		fetchFile(torrent, {
			on: {
				infoHash: () => {
					fetchedHash = true;
				},
				metadata: () => {
					fetchedMetadata = true;
				},
				download: () => {
					progress = torrent.progress * 100;
					downloadSpeed = torrent.downloadSpeed;
				},
				wire: (wire, addr) => {
					connectedPeers += 1;
					console.log(`Connected to peer ${addr}`);
				}
			}
		})
			.then(async (files) => {
				// Parse metadata
				const metadataText = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = () => reject(reader.error);
					reader.readAsText(files.metadata);
				});

				shareData = JSON.parse(metadataText);
				contentFile = files.content;

				console.log({ shareData, contentFile });

				// If not encrypted, process content immediately
				if (!shareData?.encrypted) {
					if (shareData?.type === 'url') {
						// Convert content file to text
						const text = await new Promise<string>((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = () => resolve(reader.result as string);
							reader.onerror = () => reject(reader.error);
							reader.readAsText(files.content);
						});
						decryptedContent = text;
					} else {
						// For files, just use the content file directly
						decryptedContent = files.content;
					}
					ready = true;
				}

				toast.success('Download complete!');
			})
			.catch((err) => {
				console.error('Error fetching file:', err);
				error = `Error fetching file: ${err}`;
			});
	});

	const handleSubmit = async () => {
		if (!shareData?.encrypted || !contentFile) return;

		try {
			// Use the base64 nonce string directly
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const decrypted = await decrypt(contentFile, shareData.nonce!, password);

			if (shareData.type === 'url') {
				// Convert decrypted blob to text
				decryptedContent = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = () => reject(reader.error);
					reader.readAsText(decrypted);
				});
			} else {
				decryptedContent = decrypted;
			}
			ready = true;
		} catch (err) {
			console.error('Error decrypting:', err);
			error = 'Incorrect password or corrupted data';
		}
	};
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
	<Card class="w-full max-w-md">
		<h1 class="mb-6 text-center text-2xl font-bold">(shh)ared data</h1>

		{#if error}
			<div class="mb-4 overflow-auto rounded bg-red-500 p-4 text-pretty text-white">
				{error}
			</div>
		{:else if shareData?.encrypted && !decryptedContent}
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<div>
					<Label for="password">password</Label>
					<Input
						type="password"
						id="password"
						bind:value={password}
						placeholder="Enter password"
						required
					/>
				</div>
				<Button type="submit" color="green" class="w-full">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-4 w-4 text-gray-400"
						viewBox="0 0 20 20"
						fill="white"
					>
						<path
							fill-rule="evenodd"
							d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
							clip-rule="evenodd"
						/>
					</svg>
					unlock
				</Button>
			</form>
		{:else}
			<div class="space-y-4">
				<div class="space-y-2">
					{#if fetchedHash}
						<div class="flex items-center justify-center gap-2">
							<CheckCircleOutline class="h-5 w-5 text-green-500" />
							<span>hash received</span>
						</div>
					{/if}

					{#if fetchedMetadata}
						<div class="flex items-center justify-center gap-2">
							<CheckCircleOutline class="h-5 w-5 text-green-500" />
							<span>metadata received</span>
						</div>
					{/if}

					{#if connectedPeers > 0}
						<div class="flex items-center justify-center gap-2">
							<UsersGroupOutline class="h-5 w-5 text-blue-500" />
							<span>{connectedPeers} peer{connectedPeers === 1 ? '' : 's'} connected</span>
						</div>
					{/if}
				</div>

				{#if progress > 0}
					<div class="space-y-2">
						<Progressbar color="blue" {progress} size="h-2" />

						<div class="text-sm text-gray-400">
							<p class="text-center">
								{progress.toFixed(1)}% complete
							</p>
							{#if downloadSpeed > 0}
								<p class="text-center">
									speed: {(downloadSpeed / 1024 / 1024).toFixed(2)} MB/s
								</p>
								<p class="text-center">
									time remaining: {Math.ceil(timeRemaining / 1000)}s
								</p>
							{/if}
						</div>
					</div>
				{/if}

				{#if shareData}
					<hr />
					<div class="space-y-2 text-center">
						<h2 class="text-lg font-semibold">{shareData.name}</h2>
						<div class="flex justify-between gap-2">
							<div
								class="mt-4 flex items-center justify-center gap-2 rounded bg-gray-100 p-2 text-sm break-all dark:bg-gray-800"
							>
								{#if shareData.type === 'url' && decryptedContent}
									<LinkOutline class="h-4 w-4 shrink-0" />
									<span>{decryptedContent as string}</span>
								{:else if shareData.type === 'file' && contentFile}
									<FileOutline class="h-4 w-4 shrink-0" />
									<span>{getSafeFileName(contentFile, shareData)}</span>
								{/if}
							</div>

							{#if ready && decryptedContent}
								<div class="mt-4 flex justify-center">
									{#if shareData?.type === 'url'}
										<Button
											size="sm"
											href={decryptedContent as string}
											target="_blank"
											rel="noopener noreferrer"
											color="purple"
										>
											Open Link
										</Button>
									{:else}
										<Button
											size="sm"
											color="purple"
											on:click={() => {
												const blob = decryptedContent as Blob;
												const url = URL.createObjectURL(blob);
												const a = document.createElement('a');
												a.href = url;
												a.download = getSafeFileName(blob, shareData);
												document.body.appendChild(a);
												a.click();
												document.body.removeChild(a);
												URL.revokeObjectURL(url);
											}}
										>
											Download File
										</Button>
									{/if}
								</div>
							{/if}
						</div>

						{#if shareData.description}
							<div class="flex items-center justify-center gap-2">
								<InfoCircleOutline class="h-4 w-4 shrink-0 text-gray-400" />
								<p class="text-gray-400">{shareData.description}</p>
							</div>
						{/if}
						{#if shareData.notes}
							<div class="flex items-center justify-center gap-2">
								<MessageCaptionOutline class="h-4 w-4 shrink-0 text-gray-400" />
								<p class="text-gray-400 italic">{shareData.notes}</p>
							</div>
						{/if}
						{#if shareData.expiresAt}
							<div class="flex items-center justify-center gap-2">
								<ClockOutline class="h-4 w-4 shrink-0 text-yellow-400" />
								<p class="text-yellow-400">
									expires: {new Date(shareData.expiresAt).toLocaleString()}
								</p>
							</div>
						{/if}
					</div>
				{:else}
					<p class="text-center">loading content info...</p>
					<div class="flex w-full justify-center">
						<Spinner color="blue" />
					</div>
				{/if}
			</div>
		{/if}
	</Card>
</div>
