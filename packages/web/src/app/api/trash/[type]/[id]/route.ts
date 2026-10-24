import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  restoreWorkflow,
  hardDeleteWorkflow,
} from "@/lib/db/workflows";
import {
  getProduct,
  restoreProduct,
  hardDeleteProduct,
} from "@/lib/db/products";
import {
  getHumanModel,
  restoreHumanModelDoc,
  hardDeleteHumanModelDoc,
} from "@/lib/db/human-models";
import {
  getBackground,
  restoreBackground,
  hardDeleteBackground,
} from "@/lib/db/backgrounds";
import {
  usesGcsBlobStorage,
  deleteDataObjectsWithPrefix,
} from "@fashionmentum/workflow-core";
import { resolve, join } from "path";
import { rm } from "fs/promises";
import { existsSync } from "fs";

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

type TrashType = "workflows" | "products" | "models" | "backgrounds";
type Params = { params: Promise<{ type: string; id: string }> };

function isValidType(t: string): t is TrashType {
  return ["workflows", "products", "models", "backgrounds"].includes(t);
}

/** POST /api/trash/[type]/[id] — restore an item from trash */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Unknown resource type" }, { status: 400 });
  }

  const wid = session.user.workspaceId;

  try {
    switch (type) {
      case "workflows": {
        const item = await getWorkflow(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await restoreWorkflow(wid, id);
        break;
      }
      case "products": {
        const item = await getProduct(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await restoreProduct(wid, id);
        break;
      }
      case "models": {
        const item = await getHumanModel(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await restoreHumanModelDoc(wid, id);
        break;
      }
      case "backgrounds": {
        const item = await getBackground(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await restoreBackground(wid, id);
        break;
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Restore ${type}/${id} failed:`, err);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}

/** DELETE /api/trash/[type]/[id] — permanently delete an item */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { type, id } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Unknown resource type" }, { status: 400 });
  }

  const wid = session.user.workspaceId;

  try {
    switch (type) {
      case "workflows": {
        const item = await getWorkflow(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await hardDeleteWorkflow(wid, id);
        break;
      }
      case "products": {
        const item = await getProduct(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        await hardDeleteProduct(wid, id);
        break;
      }
      case "models": {
        const item = await getHumanModel(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        if (usesGcsBlobStorage()) {
          await deleteDataObjectsWithPrefix(`models/${id}/`);
        } else {
          const dir = join(getDataRoot(), "models", id);
          if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
        }
        await hardDeleteHumanModelDoc(wid, id);
        break;
      }
      case "backgrounds": {
        const item = await getBackground(wid, id);
        if (!item?.deletedAt) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
        if (usesGcsBlobStorage()) {
          await deleteDataObjectsWithPrefix(`backgrounds/${id}/`);
        } else {
          const dir = join(getDataRoot(), "backgrounds", id);
          if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
        }
        await hardDeleteBackground(wid, id);
        break;
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Hard delete ${type}/${id} failed:`, err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
