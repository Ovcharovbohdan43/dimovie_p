import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';
import type { AuthUser } from '@dimovie/shared';

class UploadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2 * 1024 * 1024 * 1024)
  contentLength?: number;
}

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createUploadUrl(
    @Req() req: { user: AuthUser },
    @Body() dto: UploadUrlDto,
  ) {
    return this.mediaService.createUploadUrl(
      req.user.id,
      dto.filename,
      dto.contentType,
      dto.contentLength,
    );
  }
}
