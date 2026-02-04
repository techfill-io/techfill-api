import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')
    const serviceKey = this.configService.get<string>('SUPABASE_SECRET_KEY')

    if (!url || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables')
    }

    this.client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  getClient(): SupabaseClient {
    return this.client
  }

  from(table: string) {
    return this.client.from(table)
  }
}
