import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateRoomDto {
  @IsEnum(['PUBLIC', 'PRIVATE', 'PASSWORD'])
  privacy!: 'PUBLIC' | 'PRIVATE' | 'PASSWORD';

  @ValidateIf((o: CreateRoomDto) => o.privacy === 'PASSWORD')
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  password?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  maxUsers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string;
}

export class SetVideoDto {
  @IsEnum(['EMBED', 'UPLOAD'])
  type!: 'EMBED' | 'UPLOAD';

  @IsString()
  @MinLength(5)
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class JoinRoomDto {
  @IsOptional()
  @IsString()
  password?: string;
}
