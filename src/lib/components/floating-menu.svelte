<script lang="ts">
	import { userWritable } from '$lib/auth';
	import { dexie } from '$lib/dexie';
	import { liveQuery } from 'dexie';
	import { slide } from 'svelte/transition';
	import Toggle from 'svelte-toggle';
	import { torrentStats, stopTorrent, seedFiles } from '$lib/webtorrent';

	let links = liveQuery(() => 
		Promise.all([
			dexie.links.toArray(),
			dexie.magnets.toArray()
		]).then(([links, magnets]) => 
			links.map(link => {
				const magnet = magnets.find(m => m.eshareId === link.id);
				return { ...link, shortMagnet: magnet?.shortMagnet ?? null };
			})
		)
	);
	let isCollapsed = $state(window.innerWidth < 768);
	let showSettingsFor = $state('');

	const toggleSettings = (id: string) => {
		showSettingsFor = showSettingsFor === id ? '' : id;
	};

	const deleteLink = async (id: string) => {
		await dexie.links.delete(id);
	};

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
					const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
					const contentFile = new File([content.blob], 'content.bin', { type: content.blob.type });
					await seedFiles(metadataFile, contentFile, link.id);
				}
			}
		}
	};
</script>

<div class="fixed top-4 right-4 z-50">
	<button
		class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 p-2 text-white md:hidden"
		onclick={() => (isCollapsed = !isCollapsed)}
	>
		{#if isCollapsed}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16m-7 6h7"
				/>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		{/if}
	</button>

	{#if !isCollapsed}
		<div class="max-w-[400px] min-w-[300px] rounded-lg bg-gray-800 p-4 shadow-lg" transition:slide>
			<div class="mb-4 border-b border-gray-700 pb-2 text-white">
				<p class="text-sm">
					Logged in as: <span class="font-semibold">{$userWritable?.username}</span>
				</p>
			</div>

			<div class="space-y-3">
				{#each $links as link}
					<div class="relative rounded bg-gray-700 p-3">
						<div class="flex items-start justify-between">
							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-medium text-white flex items-center gap-1">
										{link.name}
										{#if link.encrypted}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
												<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
											</svg>
										{/if}
									</h3>
									<Toggle
										toggled={link.enabled}
										label=""
										on:toggle={(e) => toggleEnabled({...link, enabled: e.detail})}
										class="scale-75"
									/>
								</div>
								{#if link.description}
									<p class="text-sm text-gray-300">{link.description}</p>
								{/if}
								{#if link.notes}
									<p class="mt-1 text-sm text-gray-400 italic">{link.notes}</p>
								{/if}
								{#if $torrentStats.has(link.id)}
									{@const stats = $torrentStats.get(link.id)}
									<div class="mt-2 text-xs text-gray-400">
										<span class="mr-3">Peers: {stats?.peers}</span>
										<span class="mr-3">Upload: {(stats?.uploadSpeed ? stats.uploadSpeed / 1024: 0).toFixed(1)} KB/s</span>
										<!-- <span class="mr-3">Uploaded: {stats?.uploaded} Bytes</span> -->
										<span>Ratio: {stats?.ratio.toFixed(2)}</span>
									</div>
								{/if}
							</div>
							<button
								aria-label="menu"
								class="text-gray-400 hover:text-white"
								onclick={() => toggleSettings(link.id)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
									/>
								</svg>
							</button>
						</div>

						{#if showSettingsFor === link.id}
							<div
								class="ring-opacity-5 absolute right-0 mt-2 w-48 rounded-md bg-gray-800 ring-1 shadow-lg ring-black z-30"
								transition:slide
							>
								<div class="py-1">
									<button
										class="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
										onclick={() => navigator.clipboard.writeText(link.shortMagnet ?? '')}
									>
										Copy Link
									</button>
									<button
										class="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
										onclick={() => deleteLink(link.id)}
									>
										Delete
									</button>
								</div>
							</div>
						{/if}

						<div class="mt-2 text-sm">
							{#if link.expiresAt}
								<span class="text-yellow-400">
									Expires: {new Date(link.expiresAt).toLocaleString()}
								</span>
							{/if}
						</div>
					</div>
				{/each}

				{#if $links?.length === 0}
					<p class="py-4 text-center text-gray-400">No shared links yet</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
