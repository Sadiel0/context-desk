import { isWatchSymbol } from "@/domain/watchlist";
import { loadTicker } from "@/server/ticker-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!isWatchSymbol(symbol)) {
    return Response.json({ error: "Unknown symbol." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const result = await loadTicker(fetch, symbol, { bypassCache: refresh });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
