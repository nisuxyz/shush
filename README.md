# Shush

A privacy-focused peer-to-peer file sharing web application that enables secure, encrypted file transfers directly between browsers.

## Features

- 🔒 **End-to-End Encryption**: All files are encrypted using TweetNaCl before being shared
- 🌐 **Peer-to-Peer Transfer**: Uses WebTorrent for direct browser-to-browser file transfer
- ⏳ **Expiring Links**: Set automatic expiration times for shared files
- 💥 **Self-Destruct Option (coming soon)**: Files can be configured to delete after first download
- 🔐 **Client-Side Only**: No server storage - all data stays in your browser
- 🚀 **Fast & Efficient**: Direct P2P transfer means faster speeds for large files
- 🎯 **Simple Sharing**: Generate short, shareable links for your encrypted files

## Technology Stack

- **Frontend**: SvelteKit + TypeScript
- **P2P Network**: WebTorrent
- **Encryption**: TweetNaCl
- **Storage**: Dexie (IndexedDB)
- **Styling**: TailwindCSS

## Development

1. Clone the repository:
```bash
git clone https://github.com/nisuxyz/shush.git
cd shush
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Building for Production

Create a production build:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Testing

Run unit tests:
```bash
npm run test:unit
```

Run end-to-end tests:
```bash
npm run test:e2e
```

Run all tests:
```bash
npm run test
```

## Privacy & Security

- All encryption/decryption happens in the browser
- Files are never stored on a central server
- Peer-to-peer transfer means files go directly from sender to receiver
- Links can be set to expire automatically
- Optional self-destruct feature removes files after first download (coming soon)

## License

GPL
