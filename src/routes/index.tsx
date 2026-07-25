import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/setup", replace: true });
  },
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
  component: () => null,
});
