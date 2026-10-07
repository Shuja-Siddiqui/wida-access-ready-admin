import { apiRequest, logout, readLocalAuth } from "@/lib/api";

export interface AdminSession {
  userId: string;
  profileId: string;
  email: string;
  name: string;
  role: "super_admin";
}

export interface AdminLoginResponse {
  token: string;
  refreshToken: string;
  userType: "super_admin";
  role: "super_admin";
  email: string;
  name: string;
  teacherId: string;
}

/** Server-validated session — never trust localStorage role alone. */
export async function fetchAdminSession(): Promise<AdminSession> {
  return apiRequest<AdminSession>("/api/admin/session");
}

export async function loginSuperAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  return apiRequest<AdminLoginResponse>("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function persistAdminSession(res: AdminLoginResponse): void {
  localStorage.setItem("authToken", res.token);
  localStorage.setItem("userType", "super_admin");
  localStorage.setItem("teacherId", res.teacherId);
}

export function clearAdminSession(): void {
  logout();
}

export function hasStoredAdminToken(): boolean {
  const { token, userType } = readLocalAuth();
  return Boolean(token && userType === "super_admin");
}
