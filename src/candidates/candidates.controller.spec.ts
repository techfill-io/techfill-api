import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import type { AuthenticatedUser } from '../common/types'
import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'
import type { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto'
import { Seniority, RemotePreference } from './dto/update-candidate-profile.dto'

describe('CandidatesController', () => {
  let controller: CandidatesController
  let service: CandidatesService

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'jane@example.com',
    role: 'candidate',
  }

  const mockService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    updateVisibility: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidatesController],
      providers: [{ provide: CandidatesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<CandidatesController>(CandidatesController)
    service = module.get<CandidatesService>(CandidatesService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getProfile', () => {
    it('should call service.getProfile with user id', async () => {
      const profile = { user_id: 'user-1', name: 'Jane' }
      mockService.getProfile.mockResolvedValue(profile)

      const result = await controller.getProfile(mockUser)

      expect(result).toEqual(profile)
      expect(mockService.getProfile).toHaveBeenCalledWith('user-1')
    })
  })

  describe('updateProfile', () => {
    it('should call service.updateProfile with user id and dto', async () => {
      const dto = {
        name: 'Jane Updated',
        seniority: Seniority.SENIOR,
        remote_preference: RemotePreference.REMOTE,
      }
      const updated = { user_id: 'user-1', ...dto }
      mockService.updateProfile.mockResolvedValue(updated)

      const result = await controller.updateProfile(mockUser, dto as UpdateCandidateProfileDto)

      expect(result).toEqual(updated)
      expect(mockService.updateProfile).toHaveBeenCalledWith('user-1', dto)
    })
  })

  describe('updateVisibility', () => {
    it('should call service.updateVisibility with user id and dto', async () => {
      const dto = { is_visible: true }
      const updated = { user_id: 'user-1', is_visible: true }
      mockService.updateVisibility.mockResolvedValue(updated)

      const result = await controller.updateVisibility(mockUser, dto)

      expect(result).toEqual(updated)
      expect(mockService.updateVisibility).toHaveBeenCalledWith('user-1', dto)
    })
  })

  describe('guard and decorator metadata', () => {
    it('should have JwtAuthGuard and RolesGuard applied at class level', () => {
      const guards = Reflect.getMetadata('__guards__', CandidatesController)

      expect(guards).toBeDefined()
      expect(guards).toContain(JwtAuthGuard)
      expect(guards).toContain(RolesGuard)
    })

    it('should have candidate role required at class level', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, CandidatesController)

      expect(roles).toEqual(['candidate'])
    })
  })
})
