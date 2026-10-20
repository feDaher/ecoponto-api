export type ConnectionOptions = Record<string, string | number | boolean>;

/**
 * Appends driver options as query params, without overriding the ones already in the URL
 * (a param written in DATABASE_URL / DATABASE_REPLICA_URL always wins).
 */
export function buildConnectionUrl(connectionUrl: string, options: ConnectionOptions): string {
  const url = new URL(connectionUrl);

  for (const [option, value] of Object.entries(options)) {
    if (!url.searchParams.has(option)) {
      url.searchParams.set(option, String(value));
    }
  }

  return url.toString();
}
