// import WebTorrent from 'webtorrent';
import SimplePeer from "simple-peer";
import { dexie } from "./dexie";
import { generateShortLink } from "./utils";
import type { Torrent, WebTorrent } from "webtorrent";
import { writable } from "svelte/store";

// @ts-ignore
const WT = window.WebTorrent as WebTorrent;
export const wtclient = new WT({
  tracker: {
    rtcConfig: {
      ...SimplePeer.config,
    },
  },
});

export const METADATA_FILENAME = "metadata.json";
export const CONTENT_FILENAME = "content.bin";
export const MAGNET_TRACKERS =
  "udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.dev";

export interface SeedResult {
  magnetURI: string;
  shareLink: string;
}

interface TorrentStats {
  peers: number;
  uploadSpeed: number;
  ratio: number;
  uploaded: number;
}

// Store for torrent stats
export const torrentStats = writable(new Map<string, TorrentStats>());

// Store for caching torrent objects
export const torrentCache = writable(new Map<string, Torrent>());

const updateTorrentStats = (torrent: Torrent, eshareId: string) => {
  torrentStats.update((stats) => {
    stats.set(eshareId, {
      peers: torrent.numPeers,
      uploadSpeed: torrent.uploadSpeed,
      ratio: torrent.ratio,
      uploaded: torrent.uploaded,
    });
    return stats;
  });
};

const setupTorrentEvents = (
  torrent: Torrent,
  eshareId: string,
  selfDestruct: boolean,
) => {
  // Initial stats
  updateTorrentStats(torrent, eshareId);

  //   // Calculate total size for self-destruct
  //   const totalSize = torrent.files.reduce((sum, file) => sum + file.length, 0);
  //   let lastUploadedBytes = 0;

  // Update on various events
  const events = ["upload", "download", "wire", "noPeers"] as const;
  for (const event of events) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    torrent.on(event as any, () => {
      updateTorrentStats(torrent, eshareId);

      // TODO: work on this implementation bc it's iffy
      // Check for self-destruct condition
      // if (selfDestruct && torrent.uploaded > lastUploadedBytes) {
      //     lastUploadedBytes = torrent.uploaded;
      //     if (torrent.uploaded >= totalSize) {
      //         console.log('Self-destruct condition met - file has been shared once', { uploaded: torrent.uploaded, totalSize, files: torrent.files });
      //         cleanupExpiredLink(eshareId);
      //     }
      // }
    });
  }

  return () => {
    for (const event of events) {
      torrent.off(event, () => updateTorrentStats(torrent, eshareId));
    }
    torrentStats.update((stats) => {
      stats.delete(eshareId);
      return stats;
    });
  };
};

export const cleanupExpiredLink = async (eshareId: string) => {
  // Stop the torrent
  await stopTorrent(eshareId);

  // Delete from dexie
  await dexie.links.delete(eshareId);
  await dexie.content.where("eshareId").equals(eshareId).delete();
  await dexie.magnets.where("eshareId").equals(eshareId).delete();
};

export const stopTorrent = async (eshareId: string) => {
  torrentCache.update((cache) => {
    const torrent = cache.get(eshareId);
    if (torrent) {
      torrent.destroy();
      cache.delete(eshareId);
    }
    return cache;
  });

  torrentStats.update((stats) => {
    stats.delete(eshareId);
    return stats;
  });
};

export const setupExpiryTimeout = (link: { id: string; expiresAt?: Date }) => {
  if (!link.expiresAt) return;

  const now = new Date();
  const expiryTime = new Date(link.expiresAt);
  const timeoutMs = expiryTime.getTime() - now.getTime();

  if (timeoutMs <= 0) {
    // Already expired
    cleanupExpiredLink(link.id);
    return;
  }

  setTimeout(() => {
    cleanupExpiredLink(link.id);
  }, timeoutMs);
};

export const resumeSeeding = async () => {
  const links = await dexie.links.filter((l) => l.enabled).toArray();

  // Clear existing caches when resuming
  torrentCache.set(new Map());
  torrentStats.set(new Map());

  for (const link of links) {
    // Set up expiry timeout
    setupExpiryTimeout(link);
    const content = await dexie.content
      .where("eshareId")
      .equals(link.id)
      .first();
    if (!content) continue;

    const metadataBlob = new Blob([JSON.stringify(link)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], METADATA_FILENAME, {
      type: "application/json",
    });
    const contentFile = new File([content.blob], CONTENT_FILENAME, {
      type: content.blob.type,
    });

    await seedFiles(metadataFile, contentFile, link.id);
  }
};

export interface TorrentFiles {
  metadata: File;
  content: File;
}

export const seedFiles = async (
  metadata: File,
  content: File,
  eshareId: string,
  selfDestruct = false,
): Promise<SeedResult> => {
  return new Promise((resolve) => {
    wtclient.seed([metadata, content], (torrent: Torrent) => {
      console.log({ torrent });
      // Add torrent to cache and setup events
      torrentCache.update((cache) => {
        cache.set(eshareId, torrent);
        return cache;
      });
      setupTorrentEvents(torrent, eshareId, selfDestruct);
      const shareLink = generateShortLink(torrent.magnetURI);
      console.log("Seeding files...", {
        original: torrent.magnetURI,
        shortened: shareLink,
      });
      resolve({
        magnetURI: torrent.magnetURI,
        shareLink,
      });
    });
  });
};

type TorrentEvent =
  | "infoHash"
  | "metadata"
  | "ready"
  | "done"
  | "warning"
  | "error"
  | "download"
  | "upload"
  | "wire"
  | "noPeers";

interface ToastOptions {
  on: Partial<Record<TorrentEvent, (...args: unknown[]) => void>>;
}

export const getTorrent = (magnetURI: string) => wtclient.add(magnetURI);

export const fetchFile = (
  torrent: Torrent,
  { on }: ToastOptions,
): Promise<TorrentFiles> => {
  return new Promise((resolve, reject) => {
    try {
      for (const key of Object.keys(on) as TorrentEvent[]) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        torrent.on(key as any, on[key]!);
      }

      // Add error handler
      torrent.on("error", (err) => {
        console.error("Torrent error:", err);
        reject(err);
      });

      torrent.on("done", () => {
        const files = torrent.files;
        const metadata = files.find((f) => f.name === METADATA_FILENAME);
        const content = files.find((f) => f.name === CONTENT_FILENAME);

        if (!metadata || !content) {
          reject(new Error("Invalid torrent: missing required files"));
          return;
        }

        console.log({ metadata, content });

        // Convert to File objects
        Promise.all([
          new Promise<File>((resolve, reject) => {
            metadata.getBuffer((err, buffer) => {
              if (err) reject(err);
              else
                resolve(
                  // biome-ignore lint/style/noNonNullAssertion: <explanation>
                  new File([buffer!], METADATA_FILENAME, {
                    type: "application/json",
                  }),
                );
            });
          }),
          new Promise<File>((resolve, reject) => {
            content.getBuffer((err, buffer) => {
              if (err) reject(err);
              else
                resolve(
                  // biome-ignore lint/style/noNonNullAssertion: <explanation>
                  new File([buffer!], CONTENT_FILENAME, {
                    type: "application/octet-stream",
                  }),
                );
            });
          }),
        ])
          .then(([metadataFile, contentFile]) => {
            resolve({ metadata: metadataFile, content: contentFile });
          })
          .catch(reject);
      });
    } catch (error) {
      console.error("Invalid shortened URI:", error);
      reject(error);
    }
  });
};
