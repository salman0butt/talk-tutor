import { isUuid } from "./validation.ts";

export function requireAuthenticatedUserId(user: { id?: unknown } | null | undefined): string {
  if (!user || !isUuid(user.id)) throw new Error("Unauthorized learning request.");
  return user.id;
}

export function withAuthenticatedOwner<T extends Record<string, unknown>>(
  userId: string,
  input: T,
): Omit<T, "user_id"> & { user_id: string } {
  if (!isUuid(userId)) throw new Error("Unauthorized learning request.");
  const { user_id: _ignored, ...safe } = input;
  void _ignored;
  return { ...safe, user_id: userId } as Omit<T, "user_id"> & { user_id: string };
}

export function ownedSessionFilter(userId: string, sessionId: string) {
  if (!isUuid(userId)) throw new Error("Unauthorized learning request.");
  if (!isUuid(sessionId)) throw new Error("Session id must be a valid UUID.");
  return { id: `eq.${sessionId}`, user_id: `eq.${userId}` };
}
