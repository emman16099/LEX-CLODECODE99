import * as oidc from "openid-client";
import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable, appUsersTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  createGateProof,
  createGateQrToken,
  verifyGateQrToken,
} from "../lib/employeeQr";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const LOCAL_ADMIN_ID = "local-admin";
const LOCAL_ADMIN_USERNAME = "admin";

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function resolveRole(username: string | null): "admin" | "employee" {
  const adminUsers = (process.env.ADMIN_USERS ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
  if (username && adminUsers.includes(username.toLowerCase())) return "admin";
  return "employee";
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();

  const username = (claims.username as string) || null;
  const role = resolveRole(username);

  await db
    .insert(appUsersTable)
    .values({
      replitId: user.id,
      replitUsername: username,
      role,
    })
    .onConflictDoUpdate({
      target: appUsersTable.replitId,
      set: {
        replitUsername: username,
        role,
        updatedAt: new Date(),
      },
    });

  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.post("/auth/employee-login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and 4-digit PIN are required" });
    return;
  }
  if (typeof password !== "string" || !/^\d{4}$/.test(password)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.portalUsername, String(username)));

  if (
    !employee ||
    employee.employmentStatus !== "active" ||
    !employee.portalPasswordHash
  ) {
    res.status(401).json({ error: "Invalid username or PIN" });
    return;
  }

  const valid = await bcrypt.compare(String(password), employee.portalPasswordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or PIN" });
    return;
  }

  const [appUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.employeeId, employee.id));

  if (!appUser) {
    res.status(401).json({ error: "No portal access configured for this employee" });
    return;
  }

  const sessionData = {
    user: {
      id: appUser.replitId,
      email: null,
      firstName: employee.firstName,
      lastName: employee.lastName,
      profileImageUrl: null,
    },
    access_token: "employee",
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ success: true });
});

router.post("/auth/gate/verify", async (req: Request, res: Response) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) {
    res.status(400).json({ error: "Gate QR token is required" });
    return;
  }

  if (!verifyGateQrToken(token)) {
    res.status(401).json({ error: "Invalid office gate QR code" });
    return;
  }

  res.json(await createGateProof());
});

router.get("/auth/gate/qr", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [appUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, req.user!.id));
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  res.json({ token: createGateQrToken() });
});

router.post("/auth/admin-login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and 4-digit PIN are required" });
    return;
  }
  if (typeof password !== "string" || !/^\d{4}$/.test(password)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }

  const configuredPin = process.env.ADMIN_PIN;
  const suppliedUsername = String(username).trim().toLowerCase();
  const validPin =
    typeof configuredPin === "string" &&
    configuredPin.length === password.length &&
    crypto.timingSafeEqual(Buffer.from(configuredPin), Buffer.from(password));

  if (suppliedUsername !== LOCAL_ADMIN_USERNAME || !validPin) {
    res.status(401).json({ error: "Invalid username or PIN" });
    return;
  }

  const [adminUser] = await db
    .insert(usersTable)
    .values({
      id: LOCAL_ADMIN_ID,
      firstName: "Admin",
      lastName: "User",
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        firstName: "Admin",
        lastName: "User",
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .insert(appUsersTable)
    .values({
      replitId: LOCAL_ADMIN_ID,
      replitUsername: LOCAL_ADMIN_USERNAME,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: appUsersTable.replitId,
      set: {
        replitUsername: LOCAL_ADMIN_USERNAME,
        role: "admin",
        employeeId: null,
        updatedAt: new Date(),
      },
    });

  const sid = await createSession({
    user: {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      profileImageUrl: adminUser.profileImageUrl,
    },
    access_token: LOCAL_ADMIN_ID,
  });
  setSessionCookie(res, sid);
  res.json({ success: true });
});

router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  const session = sid ? await getSession(sid) : null;
  await clearSession(res, sid);

  if (session?.access_token === LOCAL_ADMIN_ID || session?.access_token === "employee") {
    res.redirect(origin);
    return;
  }

  const config = await getOidcConfig();
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
