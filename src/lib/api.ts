const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("authToken");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error ?? res.statusText;
    if (res.status === 401 && !path.includes("/auth/login")) {
      logout();
      window.location.href = "/login";
    }
    throw new ApiError(message, res.status);
  }
  const json = await res.json() as { success?: boolean; data?: T } | T;
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return (json as { success: boolean; data: T }).data;
  }
  return json as T;
}

export function readLocalAuth(): { userType: string | null; token: string | null } {
  return {
    userType: localStorage.getItem("userType"),
    token: localStorage.getItem("authToken"),
  };
}

export function logout() {
  ["authToken", "userType", "studentId", "teacherId", "districtId", "role"].forEach((k) =>
    localStorage.removeItem(k),
  );
}
