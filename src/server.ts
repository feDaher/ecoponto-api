import { app } from "./app";
import { env } from "./config/env";
import { prisma, prismaRead } from "./config/prisma";
import { startOutdatedHoursJob } from "./modules/operating-hours/infra/jobs/OutdatedHoursJob";
import { createShutdownHandler } from "./shared/lifecycle/graceful-shutdown";

const server = app.listen(env.PORT, () => {
  console.log(`Ecoponto API listening on port ${env.PORT}`);

  if (!env.GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY is not set: /places routes will answer 503");
  }
});

const outdatedHoursJob = startOutdatedHoursJob();

const shutdown = createShutdownHandler({
  server,
  stopJobs: () => outdatedHoursJob.stop(),
  closeResources: async () => {
    // Without a replica prismaRead is the same client: disconnect it once.
    const clients = new Set([prisma, prismaRead]);
    await Promise.all([...clients].map((client) => client.$disconnect()));
  },
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void shutdown(signal));
}
