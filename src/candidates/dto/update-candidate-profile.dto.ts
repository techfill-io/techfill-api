import { IsString, IsOptional, IsEnum, IsArray, IsUrl, MinLength } from 'class-validator'

export enum Seniority {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  PRINCIPAL = 'principal',
}

export enum RemotePreference {
  REMOTE = 'remote',
  HYBRID = 'hybrid',
  ONSITE = 'onsite',
  FLEXIBLE = 'flexible',
}

export class UpdateCandidateProfileDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  headline?: string

  @IsOptional()
  @IsEnum(Seniority, { message: 'Invalid seniority level' })
  seniority?: Seniority

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tech_stack?: string[]

  @IsOptional()
  @IsString()
  employment_preference?: string

  @IsOptional()
  @IsEnum(RemotePreference, { message: 'Invalid remote preference' })
  remote_preference?: RemotePreference

  @IsOptional()
  @IsUrl({}, { message: 'CV URL must be a valid URL' })
  cv_url?: string
}
