# n8n-nodes-warest

Community node for n8n that integrates with the WARest WhatsApp REST API. It covers servers, sessions, messaging, chats, groups, profiles, and misc helpers, plus a webhook trigger with signature verification.

## Features
- Server checks: ping, info, health/ready, CPU history, restart (immediate or scheduled).
- Session management: create (QR/pair code), logout, reconnect, devices, delete, update config.
- Messaging: text, files, media/gif/sticker/audio/document, buttons, lists, location, poll, contact, message actions (react, revoke, delete, edit, etc.).
- Chats: list, fetch messages, pin, mute/archive/clear, mark read.
- Groups: list/join/create/manage invites, participants, pictures, announcements/locked mode.
- Profile/misc: profile picture, privacy, contacts lookup, number/JID validation, crypto helpers, image processing, QR, UUID/ULID.
- Webhook trigger with HMAC signature verification and optional static/empty responses.

## Requirements
- Node.js >= 20 (matches the package engines).
- An n8n instance that supports community nodes.
- WARest API base URL and API key (X-WAREST-API-KEY / Bearer).

## Installation (n8n)
1. In n8n, enable Community Nodes.
2. Add the package name: `@triyatna/n8n-nodes-warest`.
3. Restart n8n if required.

## Configuration
Create credentials `WAREST API`:
- **Base URL**: e.g. `https://warest.example.com`
- **API Key**: value used for `X-WAREST-API-KEY` / Bearer.

## Using the nodes
- **Resource selector**: pick Server, Sessions, Messages, Chats, Message Actions, Groups, Profile, or Misc.
- **Session field**: defaults to *From List* (loads `/api/v1/session/list`) but can be switched to *By ID* for manual input.
  - The loader includes all statuses; the label shows `id (status)`.
- **Webhook trigger**: add secrets (comma/newline), choose allowed events or leave empty for all. Optional timestamp verification, raw body, static response JSON.

## Development
```bash
npm install
npm run build
```
- Sources: `nodes/` and `credentials/`.
- Build output: `dist/` (packed by `npm run build`).

## Testing locally in n8n
1. Run `npm run build`.
2. Copy/symlink `dist` into your n8n custom nodes folder (or `npm install` this package there).
3. Restart n8n and create credentials; add the “WAREST” node and try an operation.

## Notes
- File/binary sending fields support both URL/data URIs and binary properties.
- Message options such as caption/compress/view once/footers/images are inline under Messages (not in Additional Fields).
- Additional Fields for Messages are limited to presence, reply-to, and isForwarded.

## License
MIT
