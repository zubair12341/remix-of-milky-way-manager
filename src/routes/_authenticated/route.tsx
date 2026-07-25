import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Shell } from "@/components/layout/Shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Gate,
});

function Gate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // navigate() intentionally excluded from deps: TanStack's useNavigate may
  // return a fresh reference each render, which combined with router-context
  // re-renders turned this into a hot render loop (renderer pegged 97% CPU,
  // DOM never committing past the "Loading…" fallback).
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading]);
  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  return <Shell><Outlet /></Shell>;
}
