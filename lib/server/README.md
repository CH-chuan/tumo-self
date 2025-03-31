# Server-Only Code

This directory contains code that is designed to run exclusively on the server side.

## Why a separate directory?

Next.js applications run in both server and client environments. The code in this directory uses Node.js-specific modules like `fs` and `path` that are not available in the browser.

By isolating server-only code in this directory, we:

1. Clearly separate client and server code
2. Prevent accidental imports of server modules in client components
3. Make it easier for developers to identify which parts of the application require Node.js capabilities

## Important Notes

- Files in this directory should only be imported in server components or API routes
- Never import these modules in client components, as they will cause build errors
- These files will not be included in the client bundle, improving performance

## Current Server-Only Modules

- `server-media-storage.ts`: Extends the client-safe MediaStorageService to provide file system operations for saving generated media
