import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';
import type { AuthUser } from '@dimovie/shared';

class UploadUrlDto {
  filename!: string;
  contentType!: string;
}

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  createUploadUrl(
    @Req() req: { user: AuthUser },
    @Body() dto: UploadUrlDto,
  ) {
    return this.mediaService.createUploadUrl(
      req.user.id,
      dto.filename,
      dto.contentType,
    );
  }
}
