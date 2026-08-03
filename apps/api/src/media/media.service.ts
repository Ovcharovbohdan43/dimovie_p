import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const ALLOWED_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
]);

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB MVP limit

@Injectable()
export class MediaService {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrlBase: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config
      .get<string>('R2_SECRET_ACCESS_KEY')
      ?.trim();
    this.bucket = this.config.get<string>('R2_BUCKET', 'dimovie-uploads');
    this.publicUrlBase = (
      this.config.get<string>('R2_PUBLIC_URL') ?? ''
    ).replace(/\/$/, '');

    this.configured = Boolean(
      accountId && accessKeyId && secretAccessKey && this.publicUrlBase,
    );

    this.s3 = this.configured
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: accessKeyId!,
            secretAccessKey: secretAccessKey!,
          },
          forcePathStyle: false,
        })
      : null;
  }

  async createUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    contentLength?: number,
  ) {
    if (!this.s3 || !this.configured) {
      throw new ServiceUnavailableException(
        'Video upload is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL.',
      );
    }

    const normalizedType = contentType.trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(normalizedType)) {
      throw new BadRequestException(
        `Unsupported content type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`,
      );
    }

    if (
      typeof contentLength === 'number' &&
      (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES)
    ) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
      );
    }

    const safeName = this.sanitizeFilename(filename);
    const key = `uploads/${userId}/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: normalizedType,
      ...(typeof contentLength === 'number'
        ? { ContentLength: contentLength }
        : {}),
    });

    const expiresIn = 3600;
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      uploadUrl,
      publicUrl: `${this.publicUrlBase}/${key}`,
      key,
      bucket: this.bucket,
      contentType: normalizedType,
      expiresIn,
      maxBytes: MAX_UPLOAD_BYTES,
      method: 'PUT' as const,
    };
  }

  private sanitizeFilename(filename: string) {
    const base = filename.split(/[/\\]/).pop() ?? 'video';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
    return cleaned || 'video.mp4';
  }
}
