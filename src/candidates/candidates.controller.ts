import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthenticatedUser } from '../common/types'
import { CandidatesService } from './candidates.service'
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto'
import { UpdateVisibilityDto } from './dto/update-visibility.dto'

@Controller('candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('candidate')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.candidatesService.getProfile(user.id)
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCandidateProfileDto,
  ) {
    return this.candidatesService.updateProfile(user.id, dto)
  }

  @Patch('visibility')
  async updateVisibility(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateVisibilityDto) {
    return this.candidatesService.updateVisibility(user.id, dto)
  }
}
