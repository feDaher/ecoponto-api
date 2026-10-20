import type { Express } from "express";

interface RouteLayer {
  method?: string;
  handle: unknown;
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: RouteLayer[] };
  handle: { stack?: Layer[] };
}

export interface RouteInfo {
  key: string;
  method: string;
  path: string;
  handlers: unknown[];
}

export function listRoutes(app: Express): RouteInfo[] {
  const routes: RouteInfo[] = [];

  const walk = (stack: Layer[]) => {
    for (const layer of stack) {
      if (layer.route) {
        const { path, methods, stack: routeStack } = layer.route;

        for (const method of Object.keys(methods).filter((name) => name !== "_all")) {
          routes.push({
            key: `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            path,
            handlers: routeStack
              .filter((routeLayer) => !routeLayer.method || routeLayer.method === method)
              .map((routeLayer) => routeLayer.handle),
          });
        }
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  };

  walk((app as unknown as { router: { stack: Layer[] } }).router.stack);

  return routes;
}

export const samplePath = (path: string) =>
  path.replace(/:[A-Za-z]+/g, "00000000-0000-4000-8000-000000000000");
