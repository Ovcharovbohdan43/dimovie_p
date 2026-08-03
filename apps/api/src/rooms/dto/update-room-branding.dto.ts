import { IsOptional, IsString, Matches, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateRoomBrandingDto {
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayTitle?: string;
}
