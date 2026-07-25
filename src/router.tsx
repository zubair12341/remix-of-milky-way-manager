import { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface GetRouterOptions {
  /**
   * Optional custom router history. The web/SSR build leaves this undefined
   * so TanStack Router selects its default (browser history under HTTP,
   * memory history under SSR). The Electron renderer passes
   * `createHashHistory()` because its documents load from `file://`, where
   * `window.location.pathname` is the on-disk asar path and browser history
   * cannot match app routes.
   */
  history?: RouterHistory;
}

export const getRouter = (options: GetRouterOptions = {}) => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(options.history ? { history: options.history } : {}),
  });

  return router;
};
