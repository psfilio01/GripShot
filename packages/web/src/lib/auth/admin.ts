/**
 * Admin role resolution.
 *
 * Admin status is determined exclusively by the server-side ADMIN_UIDS env var
 * (comma-separated Firebase UIDs). This approach prevents privilege escalation
 * via Firestore manipulation and keeps admin logic out of the client bundle.
 */

let _adminUids: Set<string> | null = null;

function getAdminUids(): Set<string> {
  if (_adminUids) return _adminUids;
  const raw = process.env.ADMIN_UIDS ?? "";
  _adminUids = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return _adminUids;
}

export function isAdminUid(uid: string): boolean {
  return getAdminUids().has(uid);
}
