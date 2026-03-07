import { Injectable, NotFoundException } from '@nestjs/common'

import { getSupabaseAdmin } from '../common/supabase/supabase'
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto'
import { UpdateVisibilityDto } from './dto/update-visibility.dto'

interface CandidateProfile {
  name?: string
  email?: string
  location?: string
  headline?: string
  seniority?: string
  tech_stack?: string[]
  employment_preference?: string
  remote_preference?: string
  cv_url?: string
}

const FIELD_WEIGHTS: Record<string, number> = {
  name: 15,
  email: 10,
  location: 15,
  headline: 15,
  seniority: 10,
  tech_stack: 15,
  employment_preference: 5,
  remote_preference: 5,
  cv_url: 10,
}

@Injectable()
export class CandidatesService {
  async getProfile(userId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new NotFoundException('Candidate profile not found')
    }

    return data
  }

  async updateProfile(userId: string, dto: UpdateCandidateProfileDto) {
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError || !existing) {
      throw new NotFoundException('Candidate profile not found')
    }

    const updatedFields = { ...existing, ...dto }
    const completeness_score = this.calculateCompletenessScore(updatedFields)

    const { data, error } = await getSupabaseAdmin()
      .from('candidate_profiles')
      .update({ ...dto, completeness_score })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error || !data) {
      throw new NotFoundException('Failed to update candidate profile')
    }

    return data
  }

  async updateVisibility(userId: string, dto: UpdateVisibilityDto) {
    const { data, error } = await getSupabaseAdmin()
      .from('candidate_profiles')
      .update({ is_visible: dto.is_visible })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error || !data) {
      throw new NotFoundException('Candidate profile not found')
    }

    return data
  }

  private calculateCompletenessScore(profile: CandidateProfile): number {
    let score = 0

    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const value = profile[field as keyof CandidateProfile]

      if (field === 'tech_stack') {
        if (Array.isArray(value) && value.length > 0) {
          score += weight
        }
      } else if (value !== null && value !== undefined && value !== '') {
        score += weight
      }
    }

    return score
  }
}
