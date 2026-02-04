import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'protonmail.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
]

@ValidatorConstraint({ name: 'isCompanyEmail', async: false })
export class IsCompanyEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string): boolean {
    if (!email) return false
    const domain = email.split('@')[1]?.toLowerCase()
    return domain !== undefined && !FREE_EMAIL_DOMAINS.includes(domain)
  }

  defaultMessage(): string {
    return 'Please use your company email address (e.g. name@yourcompany.com)'
  }
}

export class SignupCompanyDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  @Validate(IsCompanyEmailConstraint)
  email: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  password: string

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  company_name: string

  @IsString()
  @IsNotEmpty({ message: 'Contact name is required' })
  contact_name: string
}

export { FREE_EMAIL_DOMAINS }
