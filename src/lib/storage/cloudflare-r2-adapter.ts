/**
 * Cloudflare R2 Storage Adapter
 *
 * Implementation of StorageAdapter for Cloudflare R2 (S3-compatible API).
 *
 * Required environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key
 * - R2_SECRET_ACCESS_KEY: R2 API token secret
 * - R2_MEDIA_BUCKET: Bucket name for media uploads (distinct from the backup bucket)
 * - R2_MEDIA_PUBLIC_URL: Public base URL for the media bucket (e.g. https://media.epidom.fr)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { StorageAdapter, UploadResult, UploadOptions } from "./storage-adapter.interface";

export class CloudflareR2Adapter implements StorageAdapter {
  private client: S3Client | null = null;
  private bucket: string | undefined;
  private publicUrl: string | undefined;

  constructor() {
    this.bucket = process.env.R2_MEDIA_BUCKET;
    this.publicUrl = process.env.R2_MEDIA_PUBLIC_URL?.replace(/\/$/, "");

    if (this.isConfigured()) {
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }
  }

  isConfigured(): boolean {
    return !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      this.bucket &&
      this.publicUrl
    );
  }

  async upload(file: File, options?: UploadOptions): Promise<UploadResult> {
    if (!this.isConfigured() || !this.client || !this.bucket) {
      throw new Error(
        "Cloudflare R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_MEDIA_BUCKET and R2_MEDIA_PUBLIC_URL."
      );
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const key = options?.path ? `${options.path}/${filename}` : `uploads/${filename}`;

    const arrayBuffer = await file.arrayBuffer();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
        ContentLength: file.size,
        ...(options?.cacheControl && { CacheControl: options.cacheControl }),
        ...(options?.metadata && { Metadata: options.metadata }),
      })
    );

    return {
      url: this.getUrl(key),
      key,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    };
  }

  async delete(urlOrKey: string): Promise<void> {
    if (!this.isConfigured() || !this.client || !this.bucket) {
      throw new Error("Cloudflare R2 is not configured.");
    }

    // Accept either a full public URL or a bare key
    const key = this.publicUrl && urlOrKey.startsWith(this.publicUrl)
      ? urlOrKey.slice(this.publicUrl.length + 1)
      : urlOrKey;

    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getUrl(key: string): string {
    if (!this.publicUrl) {
      throw new Error("R2_MEDIA_PUBLIC_URL is not configured.");
    }
    return `${this.publicUrl}/${key}`;
  }

  async getUsage(): Promise<{ count: number; totalBytes: number } | null> {
    if (!this.isConfigured() || !this.client || !this.bucket) return null;

    let count = 0;
    let totalBytes = 0;
    let continuationToken: string | undefined;
    const MAX_PAGES = 200;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of result.Contents ?? []) {
        count++;
        totalBytes += obj.Size ?? 0;
      }

      if (!result.IsTruncated) break;
      continuationToken = result.NextContinuationToken;
    }

    return { count, totalBytes };
  }
}
