type ModelMock = Record<string, jest.Mock>;

const defaultResult = (method: string) => {
  if (method.startsWith("findMany")) return [];
  if (method === "count") return 0;
  if (method.endsWith("Many")) return { count: 0 };
  if (method.startsWith("find")) return null;
  return {};
};

const models = new Map<string, ModelMock>();

function modelMock(): ModelMock {
  return new Proxy({} as ModelMock, {
    get(target, method: string) {
      target[method] ??= jest.fn(async () => defaultResult(method));
      return target[method];
    },
  });
}

export const prisma = new Proxy({} as Record<string, ModelMock>, {
  get(_target, model: string) {
    if (!models.has(model)) {
      models.set(model, modelMock());
    }
    return models.get(model);
  },
});

export function resetPrismaMock() {
  models.clear();
}

// Without a replica the real module also points prismaRead at the primary client.
export const prismaRead = prisma;
