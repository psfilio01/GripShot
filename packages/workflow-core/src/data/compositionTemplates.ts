import fs from "fs-extra";
import { join } from "node:path";
import fg from "fast-glob";
import type { WorkflowType } from "../types/api";
import type { ProductCategory } from "../domain/product";

export interface CompositionTemplate {
  id: string;
  name: string;
  applicableTo: WorkflowType[];
  categoryHints: ProductCategory[];
  promptBlocks: {
    composition: string;
    camera: string;
    lighting: string;
  };
}

const TEMPLATES_DIR = join(__dirname, "composition-templates");

let cachedTemplates: CompositionTemplate[] | null = null;

/**
 * Loads all composition template JSON files from `data/composition-templates/`.
 * Cached after first load — call {@link reloadCompositionTemplates} to refresh.
 */
function getTemplates(): CompositionTemplate[] {
  if (cachedTemplates) return cachedTemplates;
  cachedTemplates = loadTemplatesSync();
  return cachedTemplates;
}

function loadTemplatesSync(): CompositionTemplate[] {
  try {
    const pattern = join(TEMPLATES_DIR, "*.json").replace(/\\/g, "/");
    const files = fg.sync(pattern);
    return files
      .map((filePath) => {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw) as CompositionTemplate;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

/** Force-reload templates from disk (useful after adding new JSON files at runtime). */
export function reloadCompositionTemplates(): void {
  cachedTemplates = null;
}

/**
 * Find the best-matching composition template for a given workflow type and
 * optional product category. Falls back gracefully:
 * 1. Exact match on workflowType + category
 * 2. Any template for workflowType (ignoring category)
 * 3. null if no template matches the workflowType at all
 */
export function findCompositionTemplate(
  workflowType: WorkflowType,
  category?: ProductCategory,
): CompositionTemplate | null {
  const templates = getTemplates();
  const byWorkflow = templates.filter((t) =>
    t.applicableTo.includes(workflowType),
  );
  if (byWorkflow.length === 0) return null;

  if (category) {
    const exact = byWorkflow.find((t) => t.categoryHints.includes(category));
    if (exact) return exact;
  }

  return byWorkflow[0];
}

/** All registered composition templates (useful for tests / introspection). */
export function getAllCompositionTemplates(): readonly CompositionTemplate[] {
  return getTemplates();
}
