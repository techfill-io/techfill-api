import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { JwtPayload, AuthenticatedUser } from '../../common/types'
import { SupabaseService } from '../../database/supabase.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token')
    }

    const { data: profile, error } = await this.supabaseService
      .from('profiles')
      .select('role')
      .eq('user_id', payload.sub)
      .single()

    if (error || !profile) {
      throw new UnauthorizedException('User profile not found')
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: profile.role,
    }
  }
}
