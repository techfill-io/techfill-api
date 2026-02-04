import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SupabaseService } from '../database/supabase.service'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { LoginDto } from './dto/login.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { SignupCandidateDto } from './dto/signup-candidate.dto'
import { SignupCompanyDto, FREE_EMAIL_DOMAINS } from './dto/signup-company.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async signupCandidate(dto: SignupCandidateDto) {
    const { data: authUser, error: authError } = await this.supabaseService
      .getClient()
      .auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: false,
      })

    if (authError) {
      if (authError.message?.includes('already registered')) {
        throw new ConflictException('An account with this email already exists')
      }
      throw new BadRequestException(authError.message)
    }

    const userId = authUser.user.id

    const { error: profileError } = await this.supabaseService.from('profiles').insert({
      user_id: userId,
      role: 'candidate',
      auth_provider: 'email',
      has_password: true,
    })

    if (profileError) {
      await this.supabaseService.getClient().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create profile')
    }

    const { error: candidateError } = await this.supabaseService.from('candidate_profiles').insert({
      user_id: userId,
      name: dto.name,
      email: dto.email,
    })

    if (candidateError) {
      await this.supabaseService.getClient().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create candidate profile')
    }

    return {
      message: 'Account created. Please check your email to verify your account.',
      user: {
        id: userId,
        email: dto.email,
        role: 'candidate',
      },
    }
  }

  async signupCompany(dto: SignupCompanyDto) {
    const { data: authUser, error: authError } = await this.supabaseService
      .getClient()
      .auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: false,
      })

    if (authError) {
      if (authError.message?.includes('already registered')) {
        throw new ConflictException('An account with this email already exists')
      }
      throw new BadRequestException(authError.message)
    }

    const userId = authUser.user.id

    const { error: profileError } = await this.supabaseService.from('profiles').insert({
      user_id: userId,
      role: 'company',
      auth_provider: 'email',
      has_password: true,
    })

    if (profileError) {
      await this.supabaseService.getClient().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create profile')
    }

    const { error: companyError } = await this.supabaseService.from('companies').insert({
      owner_user_id: userId,
      name: dto.company_name,
    })

    if (companyError) {
      await this.supabaseService.getClient().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create company')
    }

    return {
      message: 'Account created. Please check your email to verify your account.',
      user: {
        id: userId,
        email: dto.email,
        role: 'company',
      },
    }
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabaseService.getClient().auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    })

    if (error) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const user = data.user

    if (!user.email_confirmed_at) {
      throw new UnauthorizedException('Please verify your email address before logging in')
    }

    const { data: profile } = await this.supabaseService
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    return {
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role,
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      remember_me: dto.remember_me ?? false,
    }
  }

  async syncGoogleUser(userId: string, role: 'candidate' | 'company') {
    const existingProfile = await this.getExistingProfile(userId)

    if (existingProfile) {
      return {
        is_new_user: false,
        user: {
          id: userId,
          role: existingProfile.role,
          has_password: existingProfile.has_password,
          auth_provider: existingProfile.auth_provider,
        },
        profile_complete: this.isProfileComplete(existingProfile),
      }
    }

    const authUser = await this.getAuthUser(userId)
    const email = authUser.user.email
    const fullName =
      authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || ''

    if (role === 'company') {
      const domain = email?.split('@')[1]?.toLowerCase()
      if (domain && FREE_EMAIL_DOMAINS.includes(domain)) {
        throw new BadRequestException(
          'Please use your company Google Workspace account to sign up as a company',
        )
      }
    }

    await this.createProfileRecord(userId, role)
    await this.createRoleRecord(userId, role, fullName, email)

    return {
      is_new_user: true,
      user: {
        id: userId,
        email,
        role,
        has_password: false,
        auth_provider: 'google',
      },
      profile_complete: false,
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { data: usersResponse } = await this.supabaseService.getClient().auth.admin.listUsers()

    const matchedUsers =
      (usersResponse as unknown as { users: Array<{ id: string; email?: string }> })?.users ?? []
    const user = matchedUsers.find(u => u.email?.toLowerCase() === dto.email.toLowerCase())

    if (user) {
      const { data: profile } = await this.supabaseService
        .from('profiles')
        .select('has_password, auth_provider')
        .eq('user_id', user.id)
        .single()

      if (
        profile?.has_password ||
        profile?.auth_provider === 'email' ||
        profile?.auth_provider === 'both'
      ) {
        const redirectTo = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:3000')
        const primaryOrigin = redirectTo.split(',')[0].trim()

        await this.supabaseService.getClient().auth.resetPasswordForEmail(dto.email, {
          redirectTo: `${primaryOrigin}/reset-password`,
        })
      }
    }

    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { data: sessionData, error: sessionError } = await this.supabaseService
      .getClient()
      .auth.setSession({
        access_token: dto.access_token,
        refresh_token: '',
      })

    if (sessionError || !sessionData.user) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    const { error: updateError } = await this.supabaseService
      .getClient()
      .auth.admin.updateUserById(sessionData.user.id, {
        password: dto.password,
      })

    if (updateError) {
      throw new BadRequestException('Failed to update password')
    }

    await this.supabaseService
      .from('profiles')
      .update({ has_password: true, auth_provider: 'both' })
      .eq('user_id', sessionData.user.id)

    return { message: 'Password has been reset successfully' }
  }

  async getMe(userId: string) {
    const { data: profile, error } = await this.supabaseService
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !profile) {
      throw new UnauthorizedException('Profile not found')
    }

    let profileData = null

    if (profile.role === 'candidate') {
      const { data } = await this.supabaseService
        .from('candidate_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      profileData = data
    } else if (profile.role === 'company') {
      const { data } = await this.supabaseService
        .from('companies')
        .select('*')
        .eq('owner_user_id', userId)
        .single()
      profileData = data
    }

    return {
      id: userId,
      role: profile.role,
      auth_provider: profile.auth_provider,
      has_password: profile.has_password,
      profile_complete: this.isProfileComplete({ ...profile, profileData }),
      profile: profileData,
      created_at: profile.created_at,
    }
  }

  async setPassword(userId: string, dto: SetPasswordDto) {
    const { error } = await this.supabaseService
      .getClient()
      .auth.admin.updateUserById(userId, { password: dto.password })

    if (error) {
      throw new BadRequestException('Failed to set password')
    }

    await this.supabaseService
      .from('profiles')
      .update({
        has_password: true,
        auth_provider: 'both',
      })
      .eq('user_id', userId)

    return { message: 'Password set successfully. You can now log in with email and password.' }
  }

  async logout(userId: string) {
    await this.supabaseService.getClient().auth.signOut()
    return { message: 'Logged out successfully' }
  }

  private isProfileComplete(profile: Record<string, unknown>): boolean {
    if (profile.role === 'candidate') return this.checkCandidateComplete(profile)
    if (profile.role === 'company') return this.checkCompanyComplete(profile)
    return true
  }

  private checkCandidateComplete(profile: Record<string, unknown>): boolean {
    const candidateProfile = profile.candidate_profiles || profile.profileData
    if (!candidateProfile) return false
    const cp = candidateProfile as Record<string, unknown>
    return !!(cp.name && cp.email && cp.location && cp.headline)
  }

  private checkCompanyComplete(profile: Record<string, unknown>): boolean {
    const company = profile.companies || profile.profileData
    if (!company) return false
    const c = company as Record<string, unknown>
    return !!(c.name && c.description && c.industry)
  }

  private async getExistingProfile(userId: string) {
    const { data } = await this.supabaseService
      .from('profiles')
      .select('*, candidate_profiles(*), companies:companies(*)')
      .eq('user_id', userId)
      .single()
    return data
  }

  private async getAuthUser(userId: string) {
    const { data: authUser, error: authError } = await this.supabaseService
      .getClient()
      .auth.admin.getUserById(userId)
    if (authError || !authUser?.user) {
      throw new BadRequestException('User not found in auth system')
    }
    return authUser
  }

  private async createProfileRecord(userId: string, role: 'candidate' | 'company') {
    const { error: profileError } = await this.supabaseService.from('profiles').insert({
      user_id: userId,
      role,
      auth_provider: 'google',
      has_password: false,
    })
    if (profileError) {
      throw new BadRequestException('Failed to create profile')
    }
  }

  private async createRoleRecord(
    userId: string,
    role: 'candidate' | 'company',
    fullName: string,
    email?: string,
  ) {
    if (role === 'candidate') {
      await this.supabaseService.from('candidate_profiles').insert({
        user_id: userId,
        name: fullName,
        email,
      })
    } else {
      await this.supabaseService.from('companies').insert({
        owner_user_id: userId,
        name: fullName ? `${fullName}'s Company` : 'My Company',
      })
    }
  }
}
