import { cleanText } from "@/domain/text";
import { safeHttpUrl } from "@/domain/urls";

export const X_SNAPSHOT_SCHEMA = "context-desk.x-snapshot.v1";

export const X_GAP =
  "Disconnected. Hosted public X lookup returned client-not-enrolled (Client Forbidden). No handle, numeric id, or post was verified. This server does not call api.x.com and does not accept a bearer token, API key, or copied session. A parent session can write data/x-snapshot.json matching context-desk.x-snapshot.v1 after a hosted public read. Until that file validates, the sweeper is not live and shows no posts.";

export type XIdentity = {
  name: string;
  username: string;
  id: string;
  serverRechecked: false;
};

export type XReference = {
  type: "quoted" | "replied_to" | "reposted";
  id: string;
  text: string | null;
};

export type XPost = {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  authorId: string;
  authorUsername: string;
  referenced: XReference[];
};

export type XDeskStatus = {
  mode: "disconnected" | "parent_snapshot" | "invalid_snapshot";
  live: false;
  polling: false;
  schema: typeof X_SNAPSHOT_SCHEMA;
  retrievedAt: string | null;
  gap: string;
  identities: XIdentity[];
  posts: XPost[];
  error: string | null;
};

export function disconnectedX(error: string | null = null): XDeskStatus {
  return {
    mode: "disconnected",
    live: false,
    polling: false,
    schema: X_SNAPSHOT_SCHEMA,
    retrievedAt: null,
    gap: X_GAP,
    identities: [],
    posts: [],
    error,
  };
}

export function readXSnapshot(raw: unknown): XDeskStatus {
  if (!raw || typeof raw !== "object") return invalid("Snapshot was not a JSON object.");
  const body = raw as Record<string, unknown>;
  if (body.schema !== X_SNAPSHOT_SCHEMA) return invalid("Snapshot schema was not context-desk.x-snapshot.v1.");
  if (body.live !== false || body.polling !== false) return invalid("A snapshot cannot claim to be live or polling.");
  if (body.retrievalMethod !== "hosted-public-x-read") return invalid("retrievalMethod must be hosted-public-x-read.");
  const retrievedAt = iso(body.retrievedAt);
  if (!retrievedAt) return invalid("retrievedAt was missing or not a time.");
  if (!Array.isArray(body.identities) || body.identities.length === 0 || body.identities.length > 10) {
    return invalid("Snapshot needs 1 to 10 identities.");
  }
  const identities: XIdentity[] = [];
  for (const entry of body.identities) {
    const identity = readIdentity(entry);
    if (!identity) return invalid("An identity was missing a name, username, or numeric id.");
    identities.push(identity);
  }
  if (!Array.isArray(body.posts) || body.posts.length > 40) return invalid("Posts must be an array of at most 40.");
  const posts: XPost[] = [];
  const seen = new Set<string>();
  for (const entry of body.posts) {
    const post = readPost(entry, identities);
    if (!post) return invalid("A post failed validation. No partial post list was kept.");
    if (seen.has(post.id)) return invalid("Duplicate post ids were rejected.");
    seen.add(post.id);
    posts.push(post);
  }
  return {
    mode: "parent_snapshot",
    live: false,
    polling: false,
    schema: X_SNAPSHOT_SCHEMA,
    retrievedAt,
    gap: "Parent snapshot loaded. This server did not re-check X and is not polling. A post is not proof its contents are true.",
    identities,
    posts,
    error: null,
  };
}

function invalid(error: string): XDeskStatus {
  return { ...disconnectedX(error), mode: "invalid_snapshot" };
}

function readIdentity(entry: unknown): XIdentity | null {
  if (!entry || typeof entry !== "object") return null;
  const body = entry as Record<string, unknown>;
  if (body.verified !== true) return null;
  const name = cleanText(typeof body.name === "string" ? body.name : "", 120).trim();
  const username = typeof body.username === "string" ? body.username : "";
  const id = typeof body.id === "string" ? body.id : "";
  if (!name || !/^[A-Za-z0-9_]{1,15}$/.test(username) || !/^\d{1,30}$/.test(id)) return null;
  return { name, username, id, serverRechecked: false };
}

function readPost(entry: unknown, identities: XIdentity[]): XPost | null {
  if (!entry || typeof entry !== "object") return null;
  const body = entry as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const authorId = typeof body.authorId === "string" ? body.authorId : "";
  const authorUsername = typeof body.authorUsername === "string" ? body.authorUsername : "";
  const identity = identities.find((item) => item.id === authorId && item.username === authorUsername);
  if (!identity || !/^\d{1,30}$/.test(id)) return null;
  const url = safeHttpUrl(typeof body.url === "string" ? body.url : "");
  if (!url || !statusUrl(url, authorUsername, id)) return null;
  const text = cleanText(typeof body.text === "string" ? body.text : "", 2000).trim();
  const createdAt = iso(body.createdAt);
  if (!text || !createdAt) return null;
  if (!Array.isArray(body.referenced) || body.referenced.length > 5) return null;
  const referenced: XReference[] = [];
  for (const item of body.referenced) {
    const reference = readReference(item);
    if (!reference) return null;
    referenced.push(reference);
  }
  return { id, url, text, createdAt, authorId, authorUsername, referenced };
}

function readReference(entry: unknown): XReference | null {
  if (!entry || typeof entry !== "object") return null;
  const body = entry as Record<string, unknown>;
  if (body.type !== "quoted" && body.type !== "replied_to" && body.type !== "reposted") return null;
  if (typeof body.id !== "string" || !/^\d{1,30}$/.test(body.id)) return null;
  const text = body.text == null ? null : cleanText(String(body.text), 2000).trim() || null;
  return { type: body.type, id: body.id, text };
}

function statusUrl(url: string, username: string, id: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "x.com" && host !== "twitter.com" && host !== "www.x.com" && host !== "www.twitter.com") return false;
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.length === 3 && parts[0] === username && parts[1] === "status" && parts[2] === id;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
