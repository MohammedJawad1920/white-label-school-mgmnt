/**
 * R2 Storage Service (v5.0)
 *
 * Wraps the AWS SDK S3 client configured for Cloudflare R2.
 * R2 is S3-compatible so we use @aws-sdk/client-s3 with a custom endpoint.
 *
 * Used by: school-profile/controller.ts (logo and principal signature uploads)
 *
 * Config (from env.ts):
 *   R2_ENDPOINT          — https://<accountId>.r2.cloudflarestorage.com
 *   R2_BUCKET            — bucket name
 *   R2_ACCESS_KEY_ID     — R2 access key
 *   R2_SECRET_ACCESS_KEY — R2 secret key
 *
 * If R2_ENDPOINT is empty, the service is in "disabled" mode and uploadFile
 * throws a feature-disabled error at the controller level (checked before calling).
 */

import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { config } from "../config/env";
import { logger } from "../utils/logger";

function buildClient(): S3Client | null {
  if (!config.R2_ENDPOINT || !config.R2_BUCKET) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: config.R2_ENDPOINT,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
}

const client = buildClient();

export function isR2Configured(): boolean {
  return client !== null && !!config.R2_BUCKET;
}

/**
 * Upload a file buffer to R2 and return its public URL.
 *
 * @param key        — object key (path within bucket), e.g. "tenants/T001/logo.png"
 * @param body       — file buffer
 * @param contentType — MIME type, e.g. "image/png"
 * @returns public URL: `${R2_ENDPOINT}/${bucket}/${key}`
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (!client) {
    throw new Error("R2 storage is not configured");
  }

  const params: PutObjectCommandInput = {
    Bucket: config.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  await client.send(new PutObjectCommand(params));
  logger.info({ key, contentType }, "R2 upload successful");

  // M-07: Use the public CDN URL (R2_PUBLIC_URL) when configured.
  // Cloudflare R2 public buckets have a CDN URL separate from the S3-compatible API endpoint.
  // Fallback to the API endpoint + bucket path when R2_PUBLIC_URL is not configured.
  const publicBase = config.R2_PUBLIC_URL || `${config.R2_ENDPOINT}/${config.R2_BUCKET}`;
  return `${publicBase}/${key}`;
}
