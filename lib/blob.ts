// Product image hosting via Vercel Blob (replaces local placeholder SVGs).
//
// Required env var:
//   BLOB_READ_WRITE_TOKEN — created automatically when a Blob store is
//   connected to the Vercel project (Project -> Storage -> Blob). For local
//   dev, run `vercel env pull` or copy the token from the Vercel dashboard
//   into .env.local.

import { put } from "@vercel/blob";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export async function uploadProductImage(file: File): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN. Connect a Blob store to this Vercel project " +
        "(Project -> Storage -> Blob) and set the token locally, or paste an image URL instead.",
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image too large (${Math.round(file.size / 1024 / 1024)}MB) — max 8MB.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const blob = await put(`products/${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return blob.url;
}
