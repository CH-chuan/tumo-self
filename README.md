# About

Tumo – an open-source AI image generation app, supporting Replicate, OpenAI, and more. 🚀

To try it out for free, go to [Takin.ai](https://tumo.takin.ai).

![Image](https://github.com/user-attachments/assets/81698751-0664-473a-962c-09b2d8d3fb75)

## Tech Stack

Tumo is built with the following technologies:

- **Frontend**: Next.js 15+, React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (can be configured to use PostgreSQL)
- **Authentication**: NextAuth.js
- **Storage**: Local filesystem or Amazon S3
- **AI Providers**: OpenAI, Replicate (easily extensible to others)
- **Package Manager**: pnpm

## Supported Models

### OpenAI

- DALL-E 2
- DALL-E 3

### Replicate

- Flux 1.1 Pro (black-forest-labs/flux-1.1-pro)
- Flux 1.1 Pro Ultra (black-forest-labs/flux-1.1-pro-ultra)
- Flux Dev (black-forest-labs/flux-dev)
- Flux Pro (black-forest-labs/flux-pro)
- Flux Schnell (black-forest-labs/flux-schnell)
- Ideogram v2 (ideogram-ai/ideogram-v2)
- Ideogram v2 Turbo (ideogram-ai/ideogram-v2-turbo)
- Photon (luma/photon)
- Photon Flash (luma/photon-flash)
- Recraft v3 (recraft-ai/recraft-v3)
- Stable Diffusion 3.5 Large (stability-ai/stable-diffusion-3.5-large)
- Stable Diffusion 3.5 Large Turbo (stability-ai/stable-diffusion-3.5-large-turbo)

## Running Locally

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/datamonet/tumo
   cd tumo
   pnpm install
   ```

2. Create an `.env` file to store API keys. Use `.env.example` as a reference.

3. Tumo uses SQLite as its database by default, which requires no additional setup. If you prefer PostgreSQL, you can configure it by uncommenting and updating the `DATABASE_URL` in your `.env` file.

4. Tumo supports two storage options for generated media files: local filesystem and Amazon S3.

   You can store generated media files in the local filesystem:

   ```
   MEDIA_STORAGE_TYPE=local
   MEDIA_STORAGE_PATH=./generated-media
   ```

   Or, you can use Amazon S3 to store generated media files:

   ```
   MEDIA_STORAGE_TYPE=s3
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=your-bucket-name
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

5. Initialize the database and create an admin user:

   ```bash
   pnpm tsx scripts/reset-db.ts
   ```

   This script will set up the database schema and create an admin user (default: admin@takin.ai with password 'demo').

6. Run the development server:

   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application and use admin user to login.

## Acknowledgment

This project is inspired by and built on top of the [ai-sdk-image-generator](https://github.com/vercel-labs/ai-sdk-image-generator) from Vercel Labs.
