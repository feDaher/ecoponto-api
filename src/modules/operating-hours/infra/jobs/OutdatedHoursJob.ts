import cron from "node-cron";
import { FlagOutdatedHoursUseCase } from "../../domain/use-cases/FlagOutdatedHoursUseCase";
import { PrismaOperatingHoursRepository } from "../repositories/PrismaOperatingHoursRepository";

export function startOutdatedHoursJob() {
  const flagOutdatedHours = new FlagOutdatedHoursUseCase(new PrismaOperatingHoursRepository());

  cron.schedule(
    "0 3 * * *",
    async () => {
      try {
        const count = await flagOutdatedHours.execute();
        console.log(`[OutdatedHoursJob] ${count} operating hours flagged as outdated`);
      } catch (error) {
        console.error("[OutdatedHoursJob] failed", error);
      }
    },
    { timezone: "America/Sao_Paulo" },
  );
}
