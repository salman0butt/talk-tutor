import "server-only";

import {
  getCurrentAccessToken,
  getCurrentUser,
  type AuthUser,
} from "@/lib/auth";
import { BillingRepository } from "@/lib/billing/repository";
import { requireAuthenticatedUserId } from "@/lib/learning/ownership";

export class BillingAuthenticationError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required.");
    this.name = "BillingAuthenticationError";
  }
}

export async function requireBillingIdentity(): Promise<{
  user: AuthUser;
  userId: string;
  accessToken: string;
  repository: BillingRepository;
}> {
  const [user, accessToken] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);

  if (!user || !accessToken) {
    throw new BillingAuthenticationError();
  }

  const userId = requireAuthenticatedUserId(user);
  return {
    user,
    userId,
    accessToken,
    repository: new BillingRepository(userId, accessToken),
  };
}

export async function getCurrentEntitlement() {
  const { repository } = await requireBillingIdentity();
  return repository.getEntitlement();
}

export async function getCurrentBillingViewModel() {
  const { repository } = await requireBillingIdentity();
  return repository.getViewModel();
}
