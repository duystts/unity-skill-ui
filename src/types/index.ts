// Core domain types — extended as features are added in later stories

export interface User {
  id: string // UUID
  email: string
  displayName: string
  avatarUrl: string | null
  isIncognito: boolean
  createdAt: string // ISO 8601
  updatedAt: string
}

export interface Workspace {
  id: string // UUID
  name: string
  description: string | null
  slug: string
  createdBy: string // User UUID
  createdAt: string
  updatedAt: string
}

// Standard API response wrappers (matches backend format)
export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number // 0-based
    size: number
    total: number
  }
}

export interface ApiError {
  status: number
  error: string
  message: string
  timestamp: string
}

// Auth types
export interface LoginResponse {
  data: {
    accessToken: string
    user: User
  }
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: 'DEVELOPER' | 'PM' | 'ADMIN'
  user: User
  createdAt: string
  updatedAt: string
}
