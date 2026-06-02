// Shared avatar utilities — used by every page that shows a user avatar.
// Keep this in sync: changing the array or hash will change colors for all users everywhere.

export const AVATAR_COLORS = ['#3574f0', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4']

export function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}
