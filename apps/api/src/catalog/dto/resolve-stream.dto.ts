import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveStreamDto {
  @IsString()
  @MinLength(10)
  catalogUrl!: string;

  @IsString()
  translationId!: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  episode?: string;

  /** From /rezka/parse — avoids a second Chromium page load. */
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsIn(['movie', 'series'])
  kind?: 'movie' | 'series';

  @IsOptional()
  @IsString()
  title?: string;
}
