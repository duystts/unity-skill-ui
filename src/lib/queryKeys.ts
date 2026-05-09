// Query key factory — all keys scoped by workspaceId as second element
// Pattern: ['resource', workspaceId, ...specifics]
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  workspaces: {
    all: () => ['workspaces'] as const,
    detail: (workspaceId: string) => ['workspaces', workspaceId] as const,
    members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
    invitations: (workspaceId: string) => ['workspaces', workspaceId, 'invitations'] as const,
  },
  projects: {
    all: (workspaceId: string) => ['projects', workspaceId] as const,
    detail: (workspaceId: string, projectId: string) =>
      ['projects', workspaceId, projectId] as const,
    stages: (workspaceId: string, projectId: string) =>
      ['projects', workspaceId, projectId, 'stages'] as const,
    triggers: (workspaceId: string, projectId: string) =>
      ['projects', workspaceId, projectId, 'triggers'] as const,
  },
  tickets: {
    all: (workspaceId: string, projectId: string) =>
      ['tickets', workspaceId, projectId] as const,
    detail: (workspaceId: string, projectId: string, ticketId: string) =>
      ['tickets', workspaceId, projectId, ticketId] as const,
    mine: (workspaceId: string) =>
      ['tickets', workspaceId, 'my-tickets'] as const,
  },
  chat: {
    messages: (workspaceId: string, projectId: string) =>
      ['chat', workspaceId, projectId] as const,
  },
  meetings: {
    all: (workspaceId: string, projectId: string) =>
      ['meetings', workspaceId, projectId] as const,
  },
  portfolio: {
    private: (workspaceId: string) => ['portfolio', workspaceId, 'private'] as const,
    public: (userId: string) => ['portfolio', 'public', userId] as const,
  },
  teamHealth: {
    dashboard: (workspaceId: string) => ['team-health', workspaceId] as const,
  },
  notifications: {
    list: () => ['notifications'] as const,
  },
  github: {
    connection: (workspaceId: string, projectId: string) =>
      ['github', workspaceId, projectId, 'connection'] as const,
  },
} as const
