import { buildConnectionUrl } from "../../src/config/database-url";
import type { ReadOnlyPrismaClient } from "../../src/config/prisma";

const PRIMARY_URL = "mysql://app:pass@primary:3306/ecoponto";
const REPLICA_URL = "mysql://reader:pass@replica:3306/ecoponto";

jest.mock("@prisma/adapter-mariadb", () => ({
  PrismaMariaDb: jest.fn().mockImplementation((url: string) => ({ url })),
}));
jest.mock("../../src/generated/prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(({ adapter }) => ({ adapter })),
}));

function loadPrismaModule(env: Record<string, string>) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    let loaded!: typeof import("../../src/config/prisma");
    jest.isolateModules(() => {
      loaded = jest.requireActual("../../src/config/prisma");
    });
    return loaded as unknown as Record<"prisma" | "prismaRead", { adapter: { url: string } }>;
  } finally {
    process.env = previous;
  }
}

describe("buildConnectionUrl", () => {
  it("appends the driver options as query params", () => {
    const url = new URL(
      buildConnectionUrl(PRIMARY_URL, { connectionLimit: 20, allowPublicKeyRetrieval: true }),
    );

    expect(url.searchParams.get("connectionLimit")).toBe("20");
    expect(url.searchParams.get("allowPublicKeyRetrieval")).toBe("true");
  });

  it("never overrides a param already written in the URL", () => {
    const url = new URL(
      buildConnectionUrl(`${PRIMARY_URL}?connectionLimit=5`, { connectionLimit: 20 }),
    );

    expect(url.searchParams.getAll("connectionLimit")).toEqual(["5"]);
  });
});

describe("primary/replica routing", () => {
  it("points prismaRead at the replica and prisma at the primary", () => {
    const { prisma, prismaRead } = loadPrismaModule({
      DATABASE_URL: PRIMARY_URL,
      DATABASE_REPLICA_URL: REPLICA_URL,
    });

    expect(new URL(prisma.adapter.url).host).toBe("primary:3306");
    expect(new URL(prismaRead.adapter.url).host).toBe("replica:3306");
    expect(new URL(prismaRead.adapter.url).username).toBe("reader");
  });

  it("applies the same pool options to the replica", () => {
    const { prismaRead } = loadPrismaModule({
      DATABASE_URL: PRIMARY_URL,
      DATABASE_REPLICA_URL: REPLICA_URL,
      DB_POOL_LIMIT: "7",
    });

    expect(new URL(prismaRead.adapter.url).searchParams.get("connectionLimit")).toBe("7");
  });

  it("falls back to the primary when DATABASE_REPLICA_URL is empty", () => {
    const { prisma, prismaRead } = loadPrismaModule({
      DATABASE_URL: PRIMARY_URL,
      DATABASE_REPLICA_URL: "",
    });

    expect(prismaRead).toBe(prisma);
  });

  it("exposes only read methods on prismaRead (checked by the compiler)", () => {
    const usage = (client: ReadOnlyPrismaClient) => [
      client.user.findMany,
      client.collectionPoint.count,
      client.$queryRaw,
      // @ts-expect-error writes must go through the primary client
      client.user.create,
      // @ts-expect-error writes must go through the primary client
      client.collectionPoint.updateMany,
      // @ts-expect-error raw writes must go through the primary client
      client.$executeRaw,
    ];

    expect(usage).toBeInstanceOf(Function);
  });

  it("only allows public key retrieval outside production", () => {
    const dev = loadPrismaModule({ DATABASE_URL: PRIMARY_URL, NODE_ENV: "development" });
    const prod = loadPrismaModule({ DATABASE_URL: PRIMARY_URL, NODE_ENV: "production" });

    expect(new URL(dev.prisma.adapter.url).searchParams.get("allowPublicKeyRetrieval")).toBe(
      "true",
    );
    expect(new URL(prod.prisma.adapter.url).searchParams.has("allowPublicKeyRetrieval")).toBe(
      false,
    );
  });
});
