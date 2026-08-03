import { IsString, MinLength } from 'class-validator';

export class KickDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
