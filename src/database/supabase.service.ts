import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService {
  private readonly adminClient: SupabaseClient
  private readonly publicClient: SupabaseClient

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')
    const serviceKey = this.configService.get<string>('SUPABASE_SECRET_KEY')
    // Prefer the newer publishable key name, fall back to legacy anon key
    const publishableKey =
      this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY')

    if (!url || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables')
    }

    this.adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    if (publishableKey) {
      this.publicClient = createClient(url, publishableKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    } else {
      // fallback to adminClient when anon key isn't provided (still works but won't be ideal for sending verification emails)
      this.publicClient = this.adminClient
    }
  }

  getAdminClient(): SupabaseClient {
    return this.adminClient
  }

  getPublicClient(): SupabaseClient {
    return this.publicClient
  }

  from(table: string) {
    return this.adminClient.from(table)
  }
}
