import { IsString, MinLength, IsOptional } from 'class-validator';

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
}
