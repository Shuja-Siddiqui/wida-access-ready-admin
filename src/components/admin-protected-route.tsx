import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchAdminSession, hasStoredAdminToken, clearAdminSession } from "@/lib/admin-auth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

/**
 * Validates super-admin session with the API before rendering protected pages.
 * localStorage alone is not trusted — role is verified server-side.
 */
export function AdminProtectedRoute({ children }: Props) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!hasStoredAdminToken()) {
      setLocation("/login");
    }
  }, [setLocation]);

  const { isLoading, isError } = useQuery({
    queryKey: ["admin-session"],
    queryFn: fetchAdminSession,
    enabled: hasStoredAdminToken(),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isError) {
      clearAdminSession();
      setLocation("/login");
    }
  }, [isError, setLocation]);

  if (!hasStoredAdminToken() || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) return null;

  return <>{children}</>;
}
