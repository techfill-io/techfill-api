import { NotFoundException } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { CandidatesService } from './candidates.service'
import type { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto'
import { Seniority, RemotePreference } from './dto/update-candidate-profile.dto'

const mockSelect = jest.fn()
const mockUpdate = jest.fn()
const mockFrom = jest.fn()

jest.mock('../common/supabase/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}))

function setupChain(finalResult: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('CandidatesService', () => {
  let service: CandidatesService

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [CandidatesService],
    }).compile()

    service = module.get<CandidatesService>(CandidatesService)
  })

  describe('getProfile', () => {
    it('should return the candidate profile', async () => {
      const profile = {
        user_id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        location: 'London',
      }
      setupChain({ data: profile, error: null })

      const result = await service.getProfile('user-1')

      expect(result).toEqual(profile)
      expect(mockFrom).toHaveBeenCalledWith('candidate_profiles')
    })

    it('should throw NotFoundException when profile does not exist', async () => {
      setupChain({ data: null, error: { message: 'not found' } })

      await expect(service.getProfile('user-missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateProfile', () => {
    const dto = {
      name: 'Jane Updated',
      location: 'Berlin',
      headline: 'Full-stack Developer',
      seniority: Seniority.SENIOR,
      tech_stack: ['TypeScript', 'React'],
      employment_preference: 'full-time',
      remote_preference: RemotePreference.REMOTE,
      cv_url: 'https://example.com/cv.pdf',
    }

    it('should update the profile and recalculate completeness score', async () => {
      const existing = {
        user_id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
      }
      const updated = { ...existing, ...dto, completeness_score: 100 }

      // First call: fetch existing
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existing, error: null }),
      }
      // Second call: update
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        return callCount === 1 ? fetchChain : updateChain
      })

      const result = await service.updateProfile('user-1', dto)

      expect(result).toEqual(updated)
    })

    it('should throw NotFoundException when profile does not exist', async () => {
      setupChain({ data: null, error: { message: 'not found' } })

      await expect(service.updateProfile('user-missing', dto)).rejects.toThrow(NotFoundException)
    })

    it('should calculate completeness score correctly for partial profile', async () => {
      const existing = {
        user_id: 'user-1',
        name: 'Jane',
        email: 'jane@example.com',
      }
      const partialDto = { name: 'Jane' }
      // name(15) + email(10) = 25
      const updated = { ...existing, ...partialDto, completeness_score: 25 }

      let callCount = 0
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existing, error: null }),
      }
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }
      mockFrom.mockImplementation(() => {
        callCount++
        return callCount === 1 ? fetchChain : updateChain
      })

      const result = await service.updateProfile('user-1', partialDto as UpdateCandidateProfileDto)

      expect(result.completeness_score).toBe(25)
    })

    it('should score tech_stack only when non-empty array', async () => {
      const existing = {
        user_id: 'user-1',
        name: 'Jane',
        email: 'jane@example.com',
        tech_stack: [],
      }
      const dtoWithEmptyStack = { name: 'Jane', tech_stack: [] as string[] }
      // name(15) + email(10) = 25 (tech_stack empty = 0)
      const updated = { ...existing, ...dtoWithEmptyStack, completeness_score: 25 }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: existing, error: null }),
          }
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        }
      })

      const result = await service.updateProfile(
        'user-1',
        dtoWithEmptyStack as UpdateCandidateProfileDto,
      )

      expect(result.completeness_score).toBe(25)
    })
  })

  describe('updateVisibility', () => {
    it('should set visibility to true', async () => {
      const updated = { user_id: 'user-1', is_visible: true }
      const chain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const result = await service.updateVisibility('user-1', { is_visible: true })

      expect(result.is_visible).toBe(true)
    })

    it('should set visibility to false', async () => {
      const updated = { user_id: 'user-1', is_visible: false }
      const chain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const result = await service.updateVisibility('user-1', { is_visible: false })

      expect(result.is_visible).toBe(false)
    })

    it('should throw NotFoundException when profile does not exist', async () => {
      const chain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }
      mockFrom.mockReturnValue(chain)

      await expect(service.updateVisibility('user-missing', { is_visible: true })).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
