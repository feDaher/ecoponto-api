import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`Ecoponto API listening on port ${env.PORT}`);
});
