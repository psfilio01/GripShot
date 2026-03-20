import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getUserByUid, getWorkspace } from "@/lib/db/users";
import { SESSION_COOKIE_NAME } from "./session";
import type { UserDoc, WorkspaceDoc } from "@/lib/db/types";

export interface ServerUser {
  user: UserDoc;
  workspace: WorkspaceDoc;
}

export async function getServerSession(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );

    const user = await getUserByUid(decoded.uid);
    if (!user) return null;

    const workspace = await getWorkspace(user.workspaceId);
    if (!workspace) return null;

    return { user, workspace };
  } catch {
    return null;
  }
}
