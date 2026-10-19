import "dotenv/config";
import autocannon from "autocannon";

const baseUrl = process.env.LOAD_TEST_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
const path = process.env.LOAD_TEST_PATH ?? "/collection-points";
const connections = Number(process.env.LOAD_TEST_CONNECTIONS ?? 100);
const duration = Number(process.env.LOAD_TEST_DURATION ?? 20);

async function main() {
  console.log(`Load test: GET ${baseUrl}${path} | ${connections} connections | ${duration}s`);

  const result = await autocannon({ url: `${baseUrl}${path}`, connections, duration });

  const failed = result.non2xx + result.errors + result.timeouts;

  console.table({
    requests: result.requests.total,
    "req/s (avg)": result.requests.average,
    "latency p50 (ms)": result.latency.p50,
    "latency p97.5 (ms)": result.latency.p97_5,
    "latency p99 (ms)": result.latency.p99,
    "latency max (ms)": result.latency.max,
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
  });

  if (failed > 0) {
    console.error(`FAILED: ${failed} unsuccessful requests`);
    process.exit(1);
  }

  console.log("PASSED: no failed requests");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
