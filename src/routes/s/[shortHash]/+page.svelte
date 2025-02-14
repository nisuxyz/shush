<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { fetchFile, getTorrent } from '$lib/webtorrent';
    import { generateMagnetURI } from '$lib/utils';
    import { decrypt } from '$lib/encryption';
    import toast from 'svelte-french-toast';
    import type { EShare } from '$lib/dexie';

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
        let torrent = getTorrent(magnet);
        fetchFile(torrent, { on: {
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
        }})
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

                console.log({shareData, contentFile});
                
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
    <div class="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-lg">
        <h1 class="mb-6 text-center text-2xl font-bold text-white">(shh)ared data</h1>

        {#if error}
            <div class="mb-4 rounded bg-red-500 p-4 text-white">
                {error}
            </div>
        {:else if shareData?.encrypted && !decryptedContent}
            <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-300">
                        This content is password protected
                    </label>
                    <input
                        type="password"
                        id="password"
                        bind:value={password}
                        class="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                        placeholder="Enter password"
                        required
                    />
                </div>
                <button
                    type="submit"
                    class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Access Content
                </button>
            </form>
        {:else}
            <div class="space-y-4">
                <p class="text-center text-gray-300">Loading your content...</p>

                {#if fetchedHash}
                    <div class="flex items-center justify-center space-x-2 text-gray-300">
                        <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Hash received</span>
                    </div>
                {/if}

                {#if fetchedMetadata}
                    <div class="flex items-center justify-center space-x-2 text-gray-300">
                        <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Metadata received</span>
                    </div>
                {/if}

                {#if connectedPeers > 0}
                    <div class="flex items-center justify-center space-x-2 text-gray-300">
                        <svg class="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                        <span>{connectedPeers} peer{connectedPeers === 1 ? '' : 's'} connected</span>
                    </div>
                {/if}

                {#if ready && decryptedContent}
                    <div class="mt-4 flex justify-center">
                        {#if shareData?.type === 'url'}
                            <!-- Handle URL -->
                            <a
                                href={decryptedContent as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                Open Link
                            </a>
                        {:else}
                            <!-- Handle File -->
                            <button
                                class="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
                            </button>
                        {/if}
                    </div>
                {/if}

                {#if progress > 0}
                    <div class="space-y-2">
                        <!-- Progress bar -->
                        <div class="h-2 w-full rounded-full bg-gray-700">
                            <div 
                                class="h-full rounded-full bg-indigo-600 transition-all duration-300" 
                                style="width: {progress}%"
                            ></div>
                        </div>
                        
                        <!-- Progress details -->
                        <div class="text-sm text-gray-400">
                            <p class="text-center">
                                {progress.toFixed(1)}% complete
                            </p>
                            {#if downloadSpeed > 0}
                                <p class="text-center">
                                    Speed: {(downloadSpeed / 1024 / 1024).toFixed(2)} MB/s
                                </p>
                                <p class="text-center">
                                    Time remaining: {Math.ceil(timeRemaining / 1000)}s
                                </p>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
