import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { hash, compare } from "bcryptjs";
import { ADMIN_COOKIE, ADMIN_CREDENTIALS, JURY_COOKIE, TEAM_COOKIE, JWT_SECRET } from "./config";
import { connectDB } from "./db";
import { AdminSettingsModel } from "./models";
import { getJuries as loadJuries, getJuries } from "./data";
import { getPortalTeams } from "./team-data";
import type { Jury, PortalTeam } from "./types";
import { TeamModel, JuryModel } from "./models";

const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const ALG = "HS256";

export async function hashPassword(plain: string): Promise<string> {
  return await hash(plain, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return await compare(plain, hashed);
}

export async function createSessionToken(payload: any): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(SECRET_KEY);
}

export async function verifySessionToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as T;
  } catch (error) {
    return null;
  }
}

/**
 * Ensures admin credentials exist in DB headers (hashed).
 * Does NOT return the password.
 */
async function ensureAdminUser() {
  await connectDB();
  let settings = await AdminSettingsModel.findOne();
  if (!settings) {
    const hashedPassword = await hashPassword(ADMIN_CREDENTIALS.password);
    settings = await AdminSettingsModel.create({
      username: ADMIN_CREDENTIALS.username,
      password: hashedPassword,
    });
  }
  return settings;
}

export async function authenticateAdmin(username: string, password: string): Promise<boolean> {
  const admin = await ensureAdminUser();
  if (admin.username !== username) return false;
  return await verifyPassword(password, admin.password);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const payload = await verifySessionToken<{ role: string; username: string }>(token);
  return payload?.role === "admin";
}

export async function findJury(identifier: string): Promise<Jury | undefined> {
  // Use DB directly to avoid leaking passwords via getJuries helper which might change
  await connectDB();
  const lower = identifier.trim().toLowerCase();
  // We need to fetch from DB because getJuries() might filter out passwords in the future
  // But searching by ID or Name is fine.
  const jury = await JuryModel.findOne({
    $or: [{ id: identifier }, { id: lower }, { name: { $regex: new RegExp(`^${lower}$`, "i") } }],
  }).lean();

  if (!jury) return undefined;
  // convert _id to string etc if needed, but lean() gives POJO. 
  // We align with Jury type.
  return {
    id: jury.id,
    name: jury.name,
    password: jury.password, // Be careful, this is hashed now (or will be)
    avatar: jury.avatar,
  };
}

export async function authenticateJury(identifier: string, password: string): Promise<Jury | undefined> {
  const jury = await findJury(identifier);
  if (!jury) return undefined;

  // Check if password is hashed (starts with $2). If not, it's legacy plain text (migration support or dev seed)
  const isHashed = jury.password.startsWith("$2");
  if (isHashed) {
    if (await verifyPassword(password, jury.password)) return jury;
  } else {
    // Fallback for plain text until migration is complete
    if (jury.password === password) {
      // Optionally upgrade hash here? For now just allow.
      return jury;
    }
  }
  return undefined;
}

export async function getCurrentJury(): Promise<Jury | undefined> {
  const store = await cookies();
  const token = store.get(JURY_COOKIE)?.value;
  if (!token) return undefined;

  const payload = await verifySessionToken<{ role: string; id: string }>(token);
  if (!payload || payload.role !== "jury") return undefined;

  const jury = await findJury(payload.id);
  if (jury) {
    // Strip password/hash before returning to app context if possible? 
    // Types require password, so we keep it but it remains safe on server.
    return jury;
  }
  return undefined;
}

export async function authenticateTeam(teamName: string, password: string): Promise<PortalTeam | undefined> {
  await connectDB();
  const lower = teamName.trim().toLowerCase();

  // Find team by name (case-insensitive)
  // We use regex for case-insensitive match on 'name'
  const teamDoc = await TeamModel.findOne({
    name: { $regex: new RegExp(`^${lower}$`, "i") }
  }).lean();

  if (!teamDoc) return undefined;

  const team: PortalTeam = {
    id: teamDoc.id,
    teamName: teamDoc.name,
    password: teamDoc.portal_password ?? "", // This is now hashed
    leaderName: teamDoc.leader,
    themeColor: teamDoc.color,
  };

  const isHashed = team.password.startsWith("$2");
  if (isHashed) {
    if (await verifyPassword(password, team.password)) {
      return team;
    }
  } else {
    if (team.password === password) return team;
  }

  return undefined;
}

export async function logoutTeam() {
  const store = await cookies();
  store.delete(TEAM_COOKIE);
}

export async function getCurrentTeam(): Promise<PortalTeam | undefined> {
  const store = await cookies();
  const token = store.get(TEAM_COOKIE)?.value;
  if (!token) return undefined;

  const payload = await verifySessionToken<{ role: string; id: string }>(token);
  if (!payload || payload.role !== "team") return undefined;

  await connectDB();
  const teamDoc = await TeamModel.findOne({ id: payload.id }).lean();
  if (!teamDoc) return undefined;

  return {
    id: teamDoc.id,
    teamName: teamDoc.name,
    password: teamDoc.portal_password ?? "",
    leaderName: teamDoc.leader,
    themeColor: teamDoc.color,
  };
}

