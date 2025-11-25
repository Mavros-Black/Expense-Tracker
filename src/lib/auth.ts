import { NextRequest } from "next/server";
import { supabaseServer } from "./supabaseServer";

export async function getUserFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user;
}
