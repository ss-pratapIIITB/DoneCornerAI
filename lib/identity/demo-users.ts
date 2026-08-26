export const appName = "DoneCornerAI";

export type DemoUserId = "cfo" | "fpna" | "viewer";

export type DemoUser = {
  id: DemoUserId;
  canEdit: boolean;
  canPublish: boolean;
};

export function parseDemoUser(header: string | null): DemoUser {
  const id: DemoUserId =
    header === "fpna" || header === "viewer" ? header : "cfo";
  const canEdit = id !== "viewer";
  return { id, canEdit, canPublish: canEdit };
}
