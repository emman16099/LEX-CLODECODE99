import crypto from "crypto";
import { db, sessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

interface SignedPayload {
  version: 2;
  purpose: "office-gate" | "gate-proof";
  expiresAt?: number;
  nonce?: string;
}

const GATE_PROOF_TTL_MS = 5 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for gate QR verification");
  }
  return secret;
}

function sign(payload: SignedPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token: string): SignedPayload | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;

  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SignedPayload>;
    if (
      payload.version !== 2 ||
      (payload.purpose !== "office-gate" && payload.purpose !== "gate-proof")
    ) {
      return null;
    }
    return payload as SignedPayload;
  } catch {
    return null;
  }
}

export function createGateQrToken(): string {
  return sign({ version: 2, purpose: "office-gate" });
}

export function verifyGateQrToken(token: string): boolean {
  return verify(token)?.purpose === "office-gate";
}

export async function createGateProof(): Promise<{ proof: string; expiresAt: string }> {
  const expiresAt = Date.now() + GATE_PROOF_TTL_MS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload: SignedPayload = {
    version: 2,
    purpose: "gate-proof",
    expiresAt,
    nonce,
  };
  await db.insert(sessionsTable).values({
    sid: `gate-proof:${nonce}`,
    sess: { purpose: "gate-proof" },
    expire: new Date(expiresAt),
  });
  return { proof: sign(payload), expiresAt: new Date(expiresAt).toISOString() };
}

export async function consumeGateProof(token: string): Promise<boolean> {
  const now = Date.now();
  const payload = verify(token);
  if (
    payload?.purpose !== "gate-proof" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= now ||
    typeof payload.nonce !== "string"
  ) {
    return false;
  }

  const claimed = await db
    .delete(sessionsTable)
    .where(and(
      eq(sessionsTable.sid, `gate-proof:${payload.nonce}`),
      gt(sessionsTable.expire, new Date(now)),
    ))
    .returning({ sid: sessionsTable.sid });
  return claimed.length === 1;
}