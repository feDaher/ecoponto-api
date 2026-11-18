import "dotenv/config";
import autocannon from "autocannon";

const baseUrl = process.env.LOAD_TEST_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
const connections = Number(process.env.LOAD_TEST_CONNECTIONS ?? 100);
const duration = Number(process.env.LOAD_TEST_DURATION ?? 20);
const maxLatencyMs = Number(process.env.LOAD_TEST_MAX_LATENCY_MS ?? 2000);
const warmupSeconds = Number(process.env.LOAD_TEST_WARMUP_SECONDS ?? 3);
const warmupConnections = 10;

interface Scenario {
  name: string;
  path: string;
}

const MANHUACU = "latitude=-20.258&longitude=-42.0336";

const defaultScenarios: Scenario[] = [
  { name: "no filters", path: "/collection-points" },
  { name: "city", path: "/collection-points?city=Manhua%C3%A7u" },
  { name: "waste type", path: "/collection-points?wasteType=PLASTIC" },
  { name: "waste types (any of)", path: "/collection-points?wasteType=PLASTIC,GLASS,BATTERIES" },
  { name: "proximity 10 km", path: `/collection-points?${MANHUACU}&radius=10` },
  {
    name: "city + waste type + radius",
    path: `/collection-points?city=Manhua%C3%A7u&wasteType=PLASTIC&${MANHUACU}&radius=10`,
  },
  {
    name: "waste types + radius 100 km",
    path: `/collection-points?wasteType=PLASTIC,GLASS,BATTERIES&${MANHUACU}&radius=100`,
  },
  { name: "origin without radius", path: `/collection-points?${MANHUACU}` },
];

const scenarios: Scenario[] = process.env.LOAD_TEST_PATH
  ? [{ name: "custom path", path: process.env.LOAD_TEST_PATH }]
  : defaultScenarios;

async function main() {
  console.log(
    `Load test: ${scenarios.length} scenario(s) | ${connections} connections | ${duration}s each (+${warmupSeconds}s warm-up) | p99 limit ${maxLatencyMs} ms`,
  );
  console.log(`Target: ${baseUrl}`);

  const rows: Record<string, Record<string, number | string>> = {};
  const failures: string[] = [];

  for (const scenario of scenarios) {
    if (warmupSeconds > 0) {
      await autocannon({
        url: `${baseUrl}${scenario.path}`,
        connections: warmupConnections,
        duration: warmupSeconds,
      });
    }

    const result = await autocannon({ url: `${baseUrl}${scenario.path}`, connections, duration });
    const unsuccessful = result.non2xx + result.errors + result.timeouts;

    rows[scenario.name] = {
      requests: result.requests.total,
      "req/s (avg)": result.requests.average,
      "p50 (ms)": result.latency.p50,
      "p97.5 (ms)": result.latency.p97_5,
      "p99 (ms)": result.latency.p99,
      "max (ms)": result.latency.max,
      "non-2xx": result.non2xx,
      errors: result.errors,
      timeouts: result.timeouts,
    };

    if (unsuccessful > 0) {
      failures.push(`${scenario.name}: ${unsuccessful} unsuccessful requests`);
    }

    if (result.latency.p99 > maxLatencyMs) {
      failures.push(`${scenario.name}: p99 ${result.latency.p99} ms exceeds ${maxLatencyMs} ms`);
    }
  }

  console.table(rows);

  if (failures.length > 0) {
    console.error(`FAILED:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
    process.exit(1);
  }

  console.log(`PASSED: no failed requests and p99 within ${maxLatencyMs} ms in every scenario`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
