// Shared presence state for socket server and API routes
export const activeUsers = new Map<string, Set<string>>(); // userId -> set of socketIds
export const socketToUser = new Map<string, string>(); // socketId -> userId
export const socketStatus = new Map<string, 'active' | 'afk'>(); // socketId -> status

export function getAggregatedStatus(userId: string): 'active' | 'afk' | 'offline' {
  const socketIds = activeUsers.get(userId);
  if (!socketIds || socketIds.size === 0) return 'offline';

  let allAfk = true;
  for (const sid of socketIds) {
    if (socketStatus.get(sid) === 'active') {
      allAfk = false;
      break;
    }
  }
  return allAfk ? 'afk' : 'active';
}
