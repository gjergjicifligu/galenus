import { cookies } from "next/headers";
import { db } from "./db";
import { hash, Staff } from "./security";
import { legacyGrantCookie } from "./migrations";
export async function hasModuleAccess(id: string, current?: Staff) {
  if (current) return true;
  const jar = await cookies(),
    token =
      jar.get(`gma_module_${id}`)?.value ||
      jar.get(legacyGrantCookie(id))?.value;
  return (
    !!token &&
    !!db()
      .prepare(
        "SELECT token FROM grants WHERE token=? AND module=? AND expires>?",
      )
      .get(hash(token), id, Date.now())
  );
}
