export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  constructor(message = "Sign in required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function assertCanEdit(userId: string): void {
  if (userId === "viewer") throw new ForbiddenError();
}

export function assertCanPublish(userId: string): void {
  if (userId === "viewer") throw new ForbiddenError();
}
