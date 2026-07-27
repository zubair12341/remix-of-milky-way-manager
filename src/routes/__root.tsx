import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LangProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-flex rounded-lg bg-primary px-6 py-3 text-primary-foreground font-semibold">Go home</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-lg bg-primary px-6 py-3 text-primary-foreground font-semibold"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Milk Shop Manager" },
      { name: "description", content: "Fast, simple management for milk and dairy shops — cash counter, udhar, monthly clients, and reports." },
      { property: "og:title", content: "Milk Shop Manager" },
      { name: "twitter:title", content: "Milk Shop Manager" },
      { property: "og:description", content: "Fast, simple management for milk and dairy shops — cash counter, udhar, monthly clients, and reports." },
      { name: "twitter:description", content: "Fast, simple management for milk and dairy shops — cash counter, udhar, monthly clients, and reports." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0885ede0-ff44-4d45-9ebb-a6888e93fae0/id-preview-d5a83d71--8a7945e7-0945-418a-8e34-d9d5addc32f3.lovable.app-1784878142283.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0885ede0-ff44-4d45-9ebb-a6888e93fae0/id-preview-d5a83d71--8a7945e7-0945-418a-8e34-d9d5addc32f3.lovable.app-1784878142283.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <HeadContent />
          <Outlet />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}
