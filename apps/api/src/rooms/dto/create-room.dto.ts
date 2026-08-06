import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
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
  @IsDateString()
  scheduledStartsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string;
}

export class UpdateRoomScheduleDto {
  /** ISO datetime, or null to clear. */
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  scheduledStartsAt!: string | null;
}
