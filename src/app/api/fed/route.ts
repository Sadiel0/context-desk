import { loadFed } from "@/server/fed-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await loadFed(fetch);
  return Response.json(result, {
    status: result.ok || result.partial ? 200 : 502,
    headers: { "cache-control": "no-store" },
  });
}
