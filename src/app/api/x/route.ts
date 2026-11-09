import { readFile } from "node:fs/promises";
import path from "node:path";
import { disconnectedX, readXSnapshot } from "@/domain/x-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = path.join(process.cwd(), "data", "x-snapshot.json");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return Response.json(disconnectedX(null), { headers: { "cache-control": "no-store" } });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const status = disconnectedX("data/x-snapshot.json was not valid JSON. No posts were shown.");
    return Response.json({ ...status, mode: "invalid_snapshot" }, { headers: { "cache-control": "no-store" } });
  }
  return Response.json(readXSnapshot(raw), { headers: { "cache-control": "no-store" } });
}
