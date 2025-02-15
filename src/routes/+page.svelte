<script lang="ts">
	import { userSaltWritable } from '$lib/auth';
	import { userWritable } from '$lib/auth';
	import { dexie } from '$lib/dexie';
	import { liveQuery } from 'dexie';
	import { torrentStats, stopTorrent, seedFiles } from '$lib/webtorrent';
	import EShareForm from './e-share-form.svelte';
	import LoginForm from './login-form.svelte';
	import {
		Button,
		Card,
		Dropdown,
		DropdownItem,
		DropdownDivider,
		Toggle,
		Modal,
		Tooltip,
		Alert
	} from 'flowbite-svelte';
	import { DotsVerticalOutline } from 'flowbite-svelte-icons';
	import toast from 'svelte-french-toast';
	// @ts-ignore
	import QrCode from 'svelte-qrcode';

	let showEShareModal = $state(false);
	let expandedQRCode = $state<{ show: boolean; value: string | null }>({
		show: false,
		value: null
	});
	let dropdownStates = $state<Record<string, boolean>>({});

	let links = liveQuery(() =>
		Promise.all([dexie.links.toArray(), dexie.magnets.toArray()]).then(([links, magnets]) =>
			links.map((link) => {
				const magnet = magnets.find((m) => m.eshareId === link.id);
				return { ...link, shortMagnet: magnet?.shortMagnet ?? null };
			})
		)
	);

	const toggleEnabled = async (link: { id: string; enabled: boolean }) => {
		const savedLink = await dexie.links.get(link.id);

		if (link.enabled !== savedLink?.enabled) {
			await dexie.links.update(link.id, { enabled: link.enabled });

			if (!link.enabled) {
				// Stop seeding if disabled
				await stopTorrent(link.id);
			} else {
				// Start seeding if enabled
				const content = await dexie.content.where('eshareId').equals(link.id).first();
				if (content) {
					const metadataBlob = new Blob([JSON.stringify(savedLink)], { type: 'application/json' });
					const metadataFile = new File([metadataBlob], 'metadata.json', {
						type: 'application/json'
					});
					const contentFile = new File([content.blob], 'content.bin', { type: content.blob.type });
					await seedFiles(metadataFile, contentFile, link.id);
				}
			}
		}
	};

	const deleteLink = async (id: string) => {
		await dexie.links.delete(id);
	};

	const onModalClose = () => {};
</script>

{#if $userSaltWritable}
	<div class="bg-gray-700 text-center text-sm text-gray-400">
		Logged in as: <span class="font-semibold">{$userWritable?.username}</span>
	</div>
{/if}
<div class="min-h-screen bg-gray-900 text-white">
	<div class="container mx-auto px-4 py-8">
		{#if !$userSaltWritable}
			<LoginForm />
		{:else}
			<div class="mb-8 text-center">
				<h1 class="text-3xl font-semibold">shush</h1>
				<p class="text-xl text-gray-400">simple & private data sharing</p>
			</div>

			<div class="mb-8 text-center">
				<Button color="purple" size="xl" on:click={() => (showEShareModal = true)}>
					(shh)are something
				</Button>
			</div>

			<Alert color="orange" class="mb-8">
				<b>important</b>:<br />
				this app does <b>not</b> use servers - your computer talks directly to whoever you're sending
				things to. keep this tab open to keep your data available!
			</Alert>
			<hr class="mb-4" />

			<div class="grid grid-cols-3 gap-6">
				{#each $links ?? [] as link}
					<Card padding="sm">
						<div class="flex items-start justify-end gap-2">
							<h3 class="mb-4 flex-1 truncate text-lg font-medium">
								{link.name}
							</h3>
							{#if link.encrypted}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="mr-2 h-4 w-4 text-gray-400"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
							<Toggle
								color="green"
								checked={link.enabled}
								size="small"
								on:change={(e) => toggleEnabled({ ...link, enabled: (e.target as any)?.checked })}
							/>
							<Button id="dropdown-{link.id}" size="xs" class="!p-0">
								<DotsVerticalOutline class="h-5 w-5" />
							</Button>
							<Dropdown
								bind:open={dropdownStates[link.id]}
								triggeredBy="#dropdown-{link.id}"
								placement="bottom-end"
							>
								<DropdownItem
									on:click={() => {
										navigator.clipboard.writeText(link.shortMagnet ?? '');
										dropdownStates[link.id] = false;
										toast.success('Link copied to clipboard');
									}}
								>
									Copy Link
								</DropdownItem>
								<DropdownDivider />
								<DropdownItem
									class="text-red-500"
									on:click={() => {
										deleteLink(link.id);
										dropdownStates[link.id] = false;
										toast.success('Share deleted');
									}}
								>
									Delete
								</DropdownItem>
							</Dropdown>
						</div>
						<div class="flex justify-between gap-4">
							<div
								class="container flex w-24 cursor-pointer justify-center"
								on:click={() => {
									expandedQRCode = { show: true, value: link.shortMagnet };
								}}
							>
								<QrCode background="black" color="white" padding={12} value={link.shortMagnet} />
								<Tooltip>click to expand</Tooltip>
							</div>
							<div>
								<div class="flex-1">
									{#if link.description}
										<p class="mt-1 text-sm text-gray-300">{link.description}</p>
									{/if}
									{#if link.notes}
										<p class="mt-1 text-sm text-gray-400 italic">{link.notes}</p>
									{/if}
									{#if $torrentStats.has(link.id)}
										{@const stats = $torrentStats.get(link.id)}
										<div class="mt-2 text-xs text-gray-400">
											<span class="mr-3">peers: {stats?.peers}</span>
											<span class="mr-3"
												>upload: {(stats?.uploadSpeed ? stats.uploadSpeed / 1024 : 0).toFixed(1)} KB/s</span
											>
											<span>ratio: {stats?.ratio.toFixed(2)}</span>
										</div>
									{/if}
									{#if link.expiresAt}
										<div class="mt-2 text-sm text-yellow-400">
											expires: {new Date(link.expiresAt).toLocaleString()}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</Card>
				{:else}
					<p class="col-span-full text-center text-gray-400">no (shh)ared data yet</p>
				{/each}
			</div>

			<EShareForm bind:showModal={showEShareModal} onClose={onModalClose} />

			<Modal bind:open={expandedQRCode.show} size="xs" class="w-fit" autoclose outsideclose>
				<div class="p-8">
					<QrCode
						background="black"
						color="white"
						padding={32}
						value={expandedQRCode.value}
						size={300}
					/>
				</div>
			</Modal>
		{/if}
	</div>
</div>
