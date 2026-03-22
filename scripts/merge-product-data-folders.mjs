#!/usr/bin/env node
/**
 * Merge duplicate product folders under `data/` (e.g. human-readable name vs Firestore id).
 *
 * Usage (from repo root):
 *   node scripts/merge-product-data-folders.mjs "Pilates Mini Ball" pilates-mini-ball
 *   node scripts/merge-product-data-folders.mjs "Pilates Mini Ball" pilates-mini-ball /absolute/path/to/data
 *
 * - Merges `data/products/<from>/` into `data/products/<to>/`
 * - Moves `data/generated/<from>/<jobId>/` into `data/generated/<to>/` (no overwrite of existing job dirs)
 * - Rewrites paths inside `data/metadata.json` (if present)
 * - Removes empty `data/products/<from>` and `data/generated/<from>` when done
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fromName = process.argv[2];
const toName = process.argv[3];
const dataRootArg = process.argv[4];

if (!fromName || !toName) {
  console.error(
    "Usage: node scripts/merge-product-data-folders.mjs <fromFolderName> <toFolderName> [dataRoot]",
  );
  process.exit(1);
}

if (fromName === toName) {
  console.error("from and to must differ.");
  process.exit(1);
}

const dataRoot = path.resolve(
  dataRootArg ?? path.join(__dirname, "..", "data"),
);

function exists(p) {
  return fs.existsSync(p);
}

function mergeProductsDir() {
  const fromDir = path.join(dataRoot, "products", fromName);
  const toDir = path.join(dataRoot, "products", toName);
  if (!exists(fromDir)) {
    console.log(`Skip products: missing ${fromDir}`);
    return;
  }
  fs.mkdirSync(toDir, { recursive: true });

  function walkMerge(rel = "") {
    const src = path.join(fromDir, rel);
    const dest = path.join(toDir, rel);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(src)) {
        walkMerge(path.join(rel, name));
      }
    } else {
      if (!exists(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`  products copy: ${path.join(fromName, rel)} -> ${toName}/${rel}`);
      } else {
        console.log(`  products skip (exists): ${toName}/${rel}`);
      }
    }
  }

  console.log(`Merging products/${fromName} -> products/${toName}`);
  walkMerge();
  fs.rmSync(fromDir, { recursive: true, force: true });
  console.log(`  removed products/${fromName}`);
}

function mergeGeneratedDir() {
  const fromDir = path.join(dataRoot, "generated", fromName);
  const toDir = path.join(dataRoot, "generated", toName);
  if (!exists(fromDir)) {
    console.log(`Skip generated: missing ${fromDir}`);
    return;
  }
  fs.mkdirSync(toDir, { recursive: true });

  for (const jobId of fs.readdirSync(fromDir, { withFileTypes: true })) {
    if (!jobId.isDirectory()) continue;
    const name = jobId.name;
    const srcJob = path.join(fromDir, name);
    const destJob = path.join(toDir, name);
    if (exists(destJob)) {
      console.warn(
        `  generated WARN: job folder already exists at ${toName}/${name}, skipping move`,
      );
      continue;
    }
    fs.renameSync(srcJob, destJob);
    console.log(`  generated move: ${fromName}/${name} -> ${toName}/${name}`);
  }

  try {
    const left = fs.readdirSync(fromDir);
    if (left.length === 0) {
      fs.rmdirSync(fromDir);
      console.log(`  removed empty generated/${fromName}`);
    } else {
      console.warn(`  generated/${fromName} not empty, left in place:`, left);
    }
  } catch {
    // ignore
  }
}

function patchMetadata() {
  const metaPath = path.join(dataRoot, "metadata.json");
  if (!exists(metaPath)) {
    console.log("No metadata.json to patch.");
    return;
  }
  const original = fs.readFileSync(metaPath, "utf8");
  /** @type {Array<[string, string]>} */
  const pairs = [
    [`generated/${fromName}/`, `generated/${toName}/`],
    [`generated\\${fromName}\\`, `generated\\${toName}\\`],
    [`products/${fromName}/`, `products/${toName}/`],
    [`products\\${fromName}\\`, `products\\${toName}\\`],
  ];
  let raw = original;
  for (const [from, to] of pairs) {
    raw = raw.split(from).join(to);
  }
  if (raw !== original) {
    fs.writeFileSync(metaPath, raw, "utf8");
    console.log("Patched metadata.json paths.");
  } else {
    console.log("metadata.json: no path replacements needed.");
  }
}

console.log(`Data root: ${dataRoot}`);
mergeProductsDir();
mergeGeneratedDir();
patchMetadata();
console.log("Done.");
