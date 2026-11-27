export interface ClosableServer {
  close(callback: (err?: Error) => void): unknown;
  closeIdleConnections?(): void;
}

export interface ShutdownOptions {
  server: ClosableServer;
  /** Background work to stop before draining (e.g. cron jobs). */
  stopJobs?: () => unknown;
  /** Releases external resources after the HTTP server has drained (e.g. DB pools). */
  closeResources?: () => Promise<unknown>;
  /** Hard limit for the whole shutdown; past it the process exits with code 1. */
  timeoutMs?: number;
  exit?: (code: number) => void;
  logger?: Pick<Console, "log" | "error">;
}

/**
 * Builds the SIGTERM/SIGINT handler: stop accepting connections, let in-flight requests
 * finish, close the DB pools, then exit. Repeated signals are ignored while it runs.
 */
export function createShutdownHandler({
  server,
  stopJobs,
  closeResources,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
  logger = console,
}: ShutdownOptions) {
  let shuttingDown = false;

  return async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`[shutdown] ${signal} received, draining connections`);

    const forceExit = setTimeout(() => {
      logger.error(`[shutdown] still busy after ${timeoutMs} ms, forcing exit`);
      exit(1);
    }, timeoutMs);
    forceExit.unref();

    try {
      await stopJobs?.();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        // Keep-alive sockets with no request in flight would hold close() open.
        server.closeIdleConnections?.();
      });
      await closeResources?.();
      clearTimeout(forceExit);
      logger.log("[shutdown] done");
      exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      logger.error("[shutdown] failed", error);
      exit(1);
    }
  };
}
