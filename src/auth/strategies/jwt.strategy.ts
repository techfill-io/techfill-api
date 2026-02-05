import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt'
import { passportJwtSecret } from 'jwks-rsa'

import { JwtPayload, AuthenticatedUser } from '../../common/types'
import { SupabaseService } from '../../database/supabase.service'

function buildJwtStrategyOptions(configService: ConfigService): StrategyOptionsWithoutRequest {
  const supabaseUrl = configService.get<string>('SUPABASE_URL')
  const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET')

  // Determine if we should use JWKS or legacy JWT secret
  // JWKS is used for asymmetric keys (ES256, RS256)
  // Legacy JWT secret is used for HS256
  const useJwks = !jwtSecret || jwtSecret.length === 0

  if (useJwks) {
    // Use JWKS endpoint for asymmetric key verification (modern Supabase)
    return {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
      algorithms: ['RS256', 'ES256'],
    }
  }

  // Use legacy JWT secret for HS256 verification
  // Try to decode as Base64 if it looks like Base64
  let secret: string | Buffer = jwtSecret
  if (jwtSecret.match(/^[A-Za-z0-9+/]+=*$/)) {
    try {
      secret = Buffer.from(jwtSecret, 'base64')
    } catch {
      secret = jwtSecret
    }
  }

  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: secret,
    algorithms: ['HS256'],
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)

  constructor(
    configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const options = buildJwtStrategyOptions(configService)
    super(options)

    const mode = 'secretOrKeyProvider' in options ? 'JWKS' : 'HS256'
    this.logger.log(`JWT Strategy initialized - mode: ${mode}`)
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    this.logger.debug(`Validating JWT payload: ${JSON.stringify(payload)}`)

    if (!payload.sub) {
      this.logger.warn('Invalid token - missing sub claim')
      throw new UnauthorizedException('Invalid token')
    }

    // Try to get the profile, but don't fail if it doesn't exist yet
    // This allows the google/sync endpoint to create the profile
    const { data: profile, error } = await this.supabaseService
      .from('profiles')
      .select('role')
      .eq('user_id', payload.sub)
      .single()

    if (error) {
      this.logger.debug(`Profile lookup error (may be OK for new users): ${error.message}`)
    }

    this.logger.debug(`User ${payload.sub} validated with role: ${profile?.role ?? 'null'}`)

    return {
      id: payload.sub,
      email: payload.email,
      role: profile?.role ?? null,
    }
  }
}
