import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { supabase, getSupabaseAdmin } from '../common/supabase/supabase'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { LoginDto } from './dto/login.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { SignupCandidateDto } from './dto/signup-candidate.dto'
import { SignupCompanyDto, FREE_EMAIL_DOMAINS } from './dto/signup-company.dto'

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  async signupCandidate(dto: SignupCandidateDto) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
    })

    if (signUpError) {
      if (signUpError.message?.includes('already registered')) {
        throw new ConflictException('An account with this email already exists')
      }
      throw new BadRequestException(signUpError.message)
    }

    const userId = signUpData.user?.id
    if (!userId) {
      throw new BadRequestException('Failed to create user')
    }

    const { error: profileError } = await getSupabaseAdmin().from('profiles').insert({
      user_id: userId,
      role: 'candidate',
      auth_provider: 'email',
      has_password: true,
    })

    if (profileError) {
      await getSupabaseAdmin().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create profile')
    }

    const { error: candidateError } = await getSupabaseAdmin().from('candidate_profiles').insert({
      user_id: userId,
      name: dto.name,
      email: dto.email,
    })

    if (candidateError) {
      await getSupabaseAdmin().auth.admin.deleteUser(userId)
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
    const { data: signUpData2, error: signUpError2 } = await supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
    })

    if (signUpError2) {
      if (signUpError2.message?.includes('already registered')) {
        throw new ConflictException('An account with this email already exists')
      }
      throw new BadRequestException(signUpError2.message)
    }

    const userId = signUpData2.user?.id
    if (!userId) {
      throw new BadRequestException('Failed to create user')
    }

    const { error: profileError } = await getSupabaseAdmin().from('profiles').insert({
      user_id: userId,
      role: 'company',
      auth_provider: 'email',
      has_password: true,
    })

    if (profileError) {
      await getSupabaseAdmin().auth.admin.deleteUser(userId)
      throw new BadRequestException('Failed to create profile')
    }

    const { error: companyError } = await getSupabaseAdmin().from('companies').insert({
      owner_user_id: userId,
      name: dto.company_name,
    })

    if (companyError) {
      await getSupabaseAdmin().auth.admin.deleteUser(userId)
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
    const { data, error } = await supabase.auth.signInWithPassword({
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

    const { data: profile } = await getSupabaseAdmin()
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
    const { data: usersResponse } = await getSupabaseAdmin().auth.admin.listUsers()

    const matchedUsers =
      (usersResponse as unknown as { users: Array<{ id: string; email?: string }> })?.users ?? []
    const user = matchedUsers.find(u => u.email?.toLowerCase() === dto.email.toLowerCase())

    if (user) {
      const { data: profile } = await getSupabaseAdmin()
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

        await supabase.auth.resetPasswordForEmail(dto.email, {
          redirectTo: `${primaryOrigin}/reset-password`,
        })
      }
    }

    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: dto.access_token,
      refresh_token: '',
    })

    if (sessionError || !sessionData.user) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(
      sessionData.user.id,
      {
        password: dto.password,
      },
    )

    if (updateError) {
      throw new BadRequestException('Failed to update password')
    }

    await getSupabaseAdmin()
      .from('profiles')
      .update({ has_password: true, auth_provider: 'both' })
      .eq('user_id', sessionData.user.id)

    return { message: 'Password has been reset successfully' }
  }

  async getMe(userId: string) {
    const { data: profile, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !profile) {
      throw new UnauthorizedException('Profile not found')
    }

    let profileData = null

    if (profile.role === 'candidate') {
      const { data } = await getSupabaseAdmin()
        .from('candidate_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      profileData = data
    } else if (profile.role === 'company') {
      const { data } = await getSupabaseAdmin()
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
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
      password: dto.password,
    })

    if (error) {
      throw new BadRequestException('Failed to set password')
    }

    await getSupabaseAdmin()
      .from('profiles')
      .update({
        has_password: true,
        auth_provider: 'both',
      })
      .eq('user_id', userId)

    return { message: 'Password set successfully. You can now log in with email and password.' }
  }

  async logout(userId: string) {
    await supabase.auth.signOut()
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
    const { data } = await getSupabaseAdmin()
      .from('profiles')
      .select('*, candidate_profiles(*), companies:companies(*)')
      .eq('user_id', userId)
      .single()
    return data
  }

  private async getAuthUser(userId: string) {
    const { data: authUser, error: authError } =
      await getSupabaseAdmin().auth.admin.getUserById(userId)
    if (authError || !authUser?.user) {
      throw new BadRequestException('User not found in auth system')
    }
    return authUser
  }

  private async createProfileRecord(userId: string, role: 'candidate' | 'company') {
    const { error: profileError } = await getSupabaseAdmin().from('profiles').insert({
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
      await getSupabaseAdmin().from('candidate_profiles').insert({
        user_id: userId,
        name: fullName,
        email,
      })
    } else {
      await getSupabaseAdmin()
        .from('companies')
        .insert({
          owner_user_id: userId,
          name: fullName ? `${fullName}'s Company` : 'My Company',
        })
    }
  }
}
