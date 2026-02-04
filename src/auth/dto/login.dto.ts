import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string

  @IsOptional()
  @IsBoolean()
  remember_me?: boolean
}
