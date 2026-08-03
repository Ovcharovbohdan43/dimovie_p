import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  createUploadUrl(userId: string, filename: string, contentType: string) {
    const bucket = this.config.get<string>('R2_BUCKET', 'dimovie-uploads');
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL', '');
    const key = `uploads/${userId}/${randomUUID()}-${filename}`;

    // Presigned URL generation requires R2 credentials in production.
    // For dev, return a mock structure the client can use once R2 is configured.
    return {
      uploadUrl: `${publicUrl || 'https://placeholder.r2.dev'}/${key}?presigned=true`,
      publicUrl: `${publicUrl}/${key}`,
      key,
      bucket,
      contentType,
      expiresIn: 3600,
    };
  }
}
