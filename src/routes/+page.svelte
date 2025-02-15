<script lang="ts">
	import { userSaltWritable } from '$lib/auth';
	import { userWritable } from '$lib/auth';
	import { dexie } from '$lib/dexie';
	import { liveQuery } from 'dexie';
	import { torrentStats, stopTorrent, seedFiles } from '$lib/webtorrent';
	import EShareForm from './e-share-form.svelte';
	import LoginForm from './login-form.svelte';
	import { Button, Card, Dropdown, DropdownItem, DropdownDivider, Toggle } from 'flowbite-svelte';
	import { DotsVerticalOutline } from 'flowbite-svelte-icons';
	import toast from 'svelte-french-toast';

	let showEShareModal = $state(false);
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

			<hr class="mb-4" />

			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each $links ?? [] as link}
					<Card padding="sm">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex min-w-0 items-center gap-2">
									<h3 class="flex max-w-48 items-center gap-1 truncate text-lg font-medium">
										{link.name}
									</h3>
								</div>
								{#if link.description}
									<p class="mt-1 text-sm text-gray-300">{link.description}</p>
								{/if}
								{#if link.notes}
									<p class="mt-1 text-sm text-gray-400 italic">{link.notes}</p>
								{/if}
								{#if $torrentStats.has(link.id)}
									{@const stats = $torrentStats.get(link.id)}
									<div class="mt-2 text-xs text-gray-400">
										<span class="mr-3">Peers: {stats?.peers}</span>
										<span class="mr-3"
											>Upload: {(stats?.uploadSpeed ? stats.uploadSpeed / 1024 : 0).toFixed(1)} KB/s</span
										>
										<span>Ratio: {stats?.ratio.toFixed(2)}</span>
									</div>
								{/if}
								{#if link.expiresAt}
									<div class="mt-2 text-sm text-yellow-400">
										Expires: {new Date(link.expiresAt).toLocaleString()}
									</div>
								{/if}
							</div>
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
					</Card>
				{:else}
					<p class="col-span-full text-center text-gray-400">no (shh)ared data yet</p>
				{/each}
			</div>

			<EShareForm bind:showModal={showEShareModal} onClose={onModalClose} />
		{/if}
	</div>
</div>
