import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.ADMIN,
    description: 'New role assigned to the user',
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class UpdateStatusDto {
  @ApiProperty({
    example: false,
    description: 'Active status of user account',
  })
  @IsBoolean()
  isActive!: boolean;
}
