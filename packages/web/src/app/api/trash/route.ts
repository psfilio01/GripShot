import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listDeletedWorkflows } from "@/lib/db/workflows";
import { listDeletedProducts } from "@/lib/db/products";
import { listDeletedHumanModels } from "@/lib/db/human-models";
import { listDeletedBackgrounds } from "@/lib/db/backgrounds";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const wid = session.user.workspaceId;

  const [workflows, products, models, backgrounds] = await Promise.all([
    listDeletedWorkflows(wid),
    listDeletedProducts(wid),
    listDeletedHumanModels(wid),
    listDeletedBackgrounds(wid),
  ]);

  return NextResponse.json({ workflows, products, models, backgrounds });
}
