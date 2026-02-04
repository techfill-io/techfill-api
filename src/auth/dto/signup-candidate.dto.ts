import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator'

export class SignupCandidateDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  password: string

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string
}
