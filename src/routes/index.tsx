import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/db";

function withFallback<T>(promise: Promise<T>, fallback: T, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.error(`${label} timed out`);
        resolve(fallback);
      }, 4000);
    }),
  ]);
}

export const Route = createFileRoute("/")({
  ssr: false,
  component: StartPage,
});

function StartPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function routeToFirstUsableScreen() {
      try {
        const [setup, session] = await Promise.all([
          withFallback(api().setup.status(), { complete: false }, "Setup status check"),
          withFallback(api().auth.session(), null, "Startup session check"),
        ]);

        if (cancelled) return;
        if (!setup.complete) navigate({ to: "/setup", replace: true });
        else if (session) navigate({ to: "/dashboard", replace: true });
        else navigate({ to: "/auth", replace: true });
      } catch (error) {
        console.error("Desktop startup routing failed", error);
        if (!cancelled) navigate({ to: "/setup", replace: true });
      }
    }

    void routeToFirstUsableScreen();

    return () => { cancelled = true; };
  }, []);

  return <div className="min-h-screen grid place-items-center text-muted-foreground">Starting…</div>;
}
