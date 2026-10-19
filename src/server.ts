import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`Ecoponto API listening on port ${env.PORT}`);

  if (!env.GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY is not set: /places routes will answer 503");
  }
});
