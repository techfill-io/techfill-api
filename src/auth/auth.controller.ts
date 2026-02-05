import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignupCandidateDto } from './dto/signup-candidate.dto'
import { SignupCompanyDto } from './dto/signup-company.dto'
import { LoginDto } from './dto/login.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { AuthenticatedUser } from '../common/types'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup/candidate')
  async signupCandidate(@Body() dto: SignupCandidateDto) {
    return this.authService.signupCandidate(dto)
  }

  @Post('signup/company')
  async signupCompany(@Body() dto: SignupCompanyDto) {
    return this.authService.signupCompany(dto)
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto)
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto)
  }

  @Post('google/sync')
  @UseGuards(JwtAuthGuard)
  async syncGoogleUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body('role') role: 'candidate' | 'company',
  ) {
    const validRole = role === 'company' ? 'company' : 'candidate'
    return this.authService.syncGoogleUser(user.id, validRole)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id)
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  async setPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPasswordDto) {
    return this.authService.setPassword(user.id, dto)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id)
  }
}
