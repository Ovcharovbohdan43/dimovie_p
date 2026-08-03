import { IsIn, IsString, MinLength } from 'class-validator';

export class SetRoleDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}
