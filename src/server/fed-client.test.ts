import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FED_CALENDAR_URL, FED_PRESS_URL } from "@/domain/sources";
import { loadFed } from "@/server/fed-client";

const calendarHtml = readFileSync(new URL("../domain/fixtures/fomc-sample.html", import.meta.url), "utf8");
const pressXml = readFileSync(new URL("../domain/fixtures/press-sample.xml", import.meta.url), "utf8");

function responseWithUrl(body: string, url: string, status = 200, headers?: HeadersInit): Response {
  const response = new Response(body, { status, headers });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("Federal Reserve reader", () => {
  it("returns parsed public sources and refuses redirects, foreign hosts, and oversize bodies", async () => {
    const ok = await loadFed(async (input) => {
      const url = String(input);
      if (url === FED_CALENDAR_URL) return responseWithUrl(calendarHtml, url);
      if (url === FED_PRESS_URL) return responseWithUrl(pressXml, url);
      return responseWithUrl("no", "https://www.federalreserve.gov/missing", 404);
    });
    expect(ok.ok).toBe(true);
    expect(ok.partial).toBe(false);
    expect(ok.calendar.data).toHaveLength(4);
    expect(ok.press.data).toHaveLength(3);

    const redirected = await loadFed(async (input) => {
      const url = String(input);
      if (url === FED_CALENDAR_URL) return new Response(null, { status: 302, headers: { location: "https://evil.example" } });
      return responseWithUrl(pressXml, FED_PRESS_URL);
    });
    expect(redirected.ok).toBe(false);
    expect(redirected.partial).toBe(true);
    expect(redirected.calendar.data).toEqual([]);
    expect(redirected.calendar.error).toMatch(/redirect/);
    expect(redirected.press.data.length).toBeGreaterThan(0);

    const foreign = await loadFed(async (input) => {
      const url = String(input);
      if (url === FED_CALENDAR_URL) return responseWithUrl(calendarHtml, "https://evil.example/calendar");
      return responseWithUrl(pressXml, FED_PRESS_URL);
    });
    expect(foreign.calendar.error).toMatch(/allowlisted host/);
    expect(foreign.calendar.data).toEqual([]);

    const huge = await loadFed(async (input) => {
      const url = String(input);
      if (url === FED_CALENDAR_URL) {
        return responseWithUrl("tiny", url, 200, { "content-length": "3000000" });
      }
      return responseWithUrl(pressXml, FED_PRESS_URL);
    });
    expect(huge.calendar.error).toMatch(/larger than this reader accepts/);
  });

  it("reports a timeout without inventing meetings", async () => {
    const result = await loadFed(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
      { timeoutMs: 20 },
    );
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(false);
    expect(result.calendar.data).toEqual([]);
    expect(result.press.data).toEqual([]);
    expect(result.calendar.error).toMatch(/timed out/);
  });
});
