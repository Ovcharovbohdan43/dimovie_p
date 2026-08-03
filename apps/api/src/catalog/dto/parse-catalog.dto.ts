import { IsString, MinLength } from 'class-validator';

export class ParseCatalogDto {
  @IsString()
  @MinLength(10)
  url!: string;
}
