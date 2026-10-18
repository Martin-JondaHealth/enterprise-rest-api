import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@enterprise.dev',
    description: 'Registered user email',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'AdminPass123!',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
