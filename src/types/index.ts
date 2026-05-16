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
  keyPrefix: string          // e.g. "US" — used to form ticket codes like "US-3"
  createdAt: string
  archivedAt: string | null
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
  ticketCode: string         // e.g. "US-3" — auto-generated, shown in UI and used in PR titles
  title: string
  description: string | null
  assigneeId: string | null
  assignmentMode: AssignmentMode
  githubPrUrl: string | null
  hasPr: boolean             // true when githubPrUrl is non-null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketAttachment {
  id: string
  ticketId: string
  uploaderId: string
  fileName: string
  url: string
  resourceType: 'image' | 'video' | 'raw'
  bytes: number
  format: string | null
  createdAt: string
}

export interface StorageStats {
  usedBytes: number
  limitBytes: number
  fileCount: number
}

export interface TicketActivity {
  id: string
  ticketId: string
  ticketCode: string       // e.g. "D-1"
  ticketTitle: string
  actorId: string | null   // null = automation
  actorName: string | null
  type: 'TICKET_CREATED' | 'STAGE_CHANGED' | 'PR_LINKED' | 'TICKET_ASSIGNED'
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string | null
  toStageName: string | null
  createdAt: string
}

export interface Meeting {
  id: string
  workspaceId: string
  projectId: string
  title: string
  scheduledAt: string       // ISO 8601
  meetingUrl: string | null // Google Meet / Zoom / Teams link
  status: 'SCHEDULED' | 'COMPLETED'
  agenda: string | null
  agendaStatus: 'GENERATING' | 'READY' | 'FAILED' | null
  summary: string | null
  actionItems: string | null  // JSON array string
  transcriptStatus: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  content: string
  senderName: string
  createdAt: string // ISO 8601
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
