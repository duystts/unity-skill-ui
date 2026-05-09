// Core domain types — extended as features are added in later stories

export interface User {
  id: string // UUID
  email: string
  displayName: string
  avatarUrl: string | null
  isIncognito: boolean
  uiMode: 'CHARACTER' | 'SERIOUS'
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

export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  createdAt: string
}

export interface WorkflowStage {
  id: string
  projectId: string
  workspaceId: string
  name: string
  position: number
  isClosedState: boolean
  createdAt: string
}

export interface AutoTriggerRule {
  id: string
  projectId: string
  workspaceId: string
  triggerType: 'PR_OPENED' | 'PR_MERGED' | 'PR_CLOSED' | 'PR_REVIEWED'
  sourceStageId: string | null
  targetStageId: string
}

export type AssignmentMode = 'NONE' | 'ASSIGNED' | 'OPEN_POOL'

export interface Ticket {
  id: string
  workspaceId: string
  projectId: string
  stageId: string | null
  title: string
  description: string | null
  assigneeId: string | null
  assignmentMode: AssignmentMode
  githubPrUrl: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Shape returned by GET /workspaces/{id}/members  (flat — no nested user) */
export interface WorkspaceMember {
  userId: string
  email: string
  displayName: string | null
  role: 'DEVELOPER' | 'PM' | 'ADMIN'
  joinedAt: string
  /** Legacy nested shape used by some endpoints — may be absent */
  user?: Pick<User, 'displayName' | 'email'>
}
