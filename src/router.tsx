import { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface GetRouterOptions {
  /**
   * Optional custom router history. The SPA build leaves this undefined so
   * TanStack Router uses browser history against the served origin.
   */
  history?: RouterHistory;
}

export const getRouter = (options: GetRouterOptions = {}) => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: !options.history,
    defaultPreloadStaleTime: 0,
    ...(options.history ? { history: options.history } : {}),
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
