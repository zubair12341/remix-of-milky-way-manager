import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/db";

function withFallback<T>(promise: Promise<T>, fallback: T, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error(`${label} timed out`);
      resolve(fallback);
    }, 4000);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Milk Shop Manager Desktop" },
      { name: "description", content: "Desktop startup screen for Milk Shop Manager, routing safely to setup, sign in, or dashboard." },
      { property: "og:title", content: "Milk Shop Manager Desktop" },
      { property: "og:description", content: "Desktop startup screen for Milk Shop Manager, routing safely to setup, sign in, or dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
