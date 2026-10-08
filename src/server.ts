import { app } from "./app";
import { env } from "./config/env";
import { startOutdatedHoursJob } from "./modules/operating-hours/infra/jobs/OutdatedHoursJob";

app.listen(env.PORT, () => {
  console.log(`Ecoponto API listening on port ${env.PORT}`);
});

startOutdatedHoursJob();
