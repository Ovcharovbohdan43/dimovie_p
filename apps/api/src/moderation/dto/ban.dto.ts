import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BanDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
