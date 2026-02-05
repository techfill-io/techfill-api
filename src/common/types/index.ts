export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

export interface JwtPayload {
  sub: string
  email: string
  role?: string
  aud?: string
}

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'candidate' | 'company' | 'admin' | null
}
