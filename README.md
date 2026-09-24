# Magic Code

Magic Code is a desktop-first AI workspace for creating and refining code, copy, and visual artifacts through chat, direct selection, region selection, annotations, version history, comparison, and export.

## Getting started

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. On first launch, the workspace starts with an empty conversation. Configure a supported model provider in **Settings → Models & API** before sending a request. The API key and provider settings are stored in this browser's local storage; do not use a shared browser profile for sensitive credentials.

## Production build

```bash
npm run build
npm run start
```

## Notes

- Model requests are sent through the application's server route; failed or unconfigured requests are reported and do not create a fake artifact version.
- Workspace conversations, settings, and provider credentials are stored locally in the browser. There is no cloud account or synchronization service.
- The repository intentionally excludes local environment files, dependencies, and build output.
