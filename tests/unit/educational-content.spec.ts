import { ContentFormat, ContentLevel, ContentStatus } from "../../src/generated/prisma/enums";
import {
  type EducationalContent,
  slugify,
} from "../../src/modules/educational-content/domain/entities/EducationalContent";
import type {
  CreateEducationalContentData,
  IEducationalContentRepository,
  UpdateEducationalContentData,
} from "../../src/modules/educational-content/domain/repositories/IEducationalContentRepository";
import {
  CreateEducationalContentUseCase,
  type CreateEducationalContentInput,
} from "../../src/modules/educational-content/domain/use-cases/CreateEducationalContentUseCase";
import { FindEducationalContentByIdUseCase } from "../../src/modules/educational-content/domain/use-cases/FindEducationalContentByIdUseCase";
import { FindManagedEducationalContentUseCase } from "../../src/modules/educational-content/domain/use-cases/FindManagedEducationalContentUseCase";
import { GetEducationalContentStatsUseCase } from "../../src/modules/educational-content/domain/use-cases/GetEducationalContentStatsUseCase";
import { GetFeaturedEducationalContentUseCase } from "../../src/modules/educational-content/domain/use-cases/GetFeaturedEducationalContentUseCase";
import { UpdateEducationalContentUseCase } from "../../src/modules/educational-content/domain/use-cases/UpdateEducationalContentUseCase";
import type { IWasteCategoryRepository } from "../../src/modules/waste-categories/domain/repositories/IWasteCategoryRepository";
import { AppError } from "../../src/shared/errors/AppError";

class InMemoryContentRepository implements IEducationalContentRepository {
  contents = new Map<string, EducationalContent>();
  private sequence = 0;

  async create(data: CreateEducationalContentData) {
    const now = new Date();
    const content: EducationalContent = {
      ...data,
      id: `content-${++this.sequence}`,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (content.featured) this.clearFeatured();
    this.contents.set(content.id, content);
    return content;
  }

  async findById(id: string) {
    return this.contents.get(id) ?? null;
  }

  async findBySlug(slug: string) {
    return [...this.contents.values()].find((content) => content.slug === slug) ?? null;
  }

  async findPublished() {
    return [...this.contents.values()].filter(
      (content) => content.status === ContentStatus.PUBLISHED,
    );
  }

  async findPublishedById(id: string) {
    const content = this.contents.get(id);
    return content?.status === ContentStatus.PUBLISHED ? content : null;
  }

  async findFeatured() {
    return (
      [...this.contents.values()].find(
        (content) => content.featured && content.status === ContentStatus.PUBLISHED,
      ) ?? null
    );
  }

  async findManaged() {
    const items = [...this.contents.values()];
    return { items, total: items.length, page: 1, pageSize: 10 };
  }

  getStats = jest.fn(async () => ({
    total: 0,
    published: 0,
    drafts: 0,
    pendingReview: 0,
    addedThisMonth: 0,
    totalViews: 0,
    byFormat: {
      DISPOSAL_GUIDE: 0,
      DIY_TUTORIAL: 0,
      QUICK_FACT: 0,
      COMMUNITY_EVENT: 0,
    },
  }));

  async update(id: string, data: UpdateEducationalContentData) {
    const current = this.contents.get(id)!;
    if (data.featured) this.clearFeatured();
    const updated = { ...current, ...data, updatedAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }

  async incrementViews(id: string) {
    const current = this.contents.get(id)!;
    this.contents.set(id, { ...current, viewCount: current.viewCount + 1 });
  }

  async delete(id: string) {
    this.contents.delete(id);
  }

  private clearFeatured() {
    for (const [id, content] of this.contents) {
      if (content.featured) this.contents.set(id, { ...content, featured: false });
    }
  }
}

const categories = new Map([
  ["category-plastic", { id: "category-plastic", name: "PLASTIC", active: true }],
  ["category-inactive", { id: "category-inactive", name: "OLD", active: false }],
]);

const categoryRepository = {
  findById: async (id: string) => {
    const category = categories.get(id);
    return category ? { ...category, createdAt: new Date(), updatedAt: new Date() } : null;
  },
} as unknown as IWasteCategoryRepository;

function input(overrides: Partial<CreateEducationalContentInput> = {}) {
  return {
    categoryId: "category-plastic",
    title: "Como descartar plástico",
    summary: "Resumo",
    content: "Conteúdo",
    format: ContentFormat.DISPOSAL_GUIDE,
    level: ContentLevel.ESSENTIAL,
    readingTimeMinutes: 3,
    xpReward: 0,
    coverImageUrl: null,
    status: ContentStatus.DRAFT,
    featured: false,
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, statusCode: number) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode });
}

let repository: InMemoryContentRepository;
let create: CreateEducationalContentUseCase;
let update: UpdateEducationalContentUseCase;

beforeEach(() => {
  repository = new InMemoryContentRepository();
  create = new CreateEducationalContentUseCase(repository, categoryRepository);
  update = new UpdateEducationalContentUseCase(repository, categoryRepository);
});

describe("slugify", () => {
  it.each([
    ["Como Descartar Plástico", "como-descartar-plastico"],
    ["Óleo de cozinha: o que fazer?", "oleo-de-cozinha-o-que-fazer"],
    ["  Pilhas & Baterias!!  ", "pilhas-baterias"],
    ["!!!", ""],
  ])("turns %j into %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("never ends with a hyphen after truncating to 191 characters", () => {
    const slug = slugify(`${"a".repeat(190)} b`);

    expect(slug).toHaveLength(190);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("CreateEducationalContentUseCase", () => {
  it("creates a draft with a slug derived from the title and no publication date", async () => {
    const content = await create.execute(input());

    expect(content).toMatchObject({
      slug: "como-descartar-plastico",
      status: ContentStatus.DRAFT,
      publishedAt: null,
    });
  });

  it("normalizes an explicit slug", async () => {
    const content = await create.execute(input({ slug: "Guia-Rápido" }));

    expect(content.slug).toBe("guia-rapido");
  });

  it("stamps the publication date when created as published", async () => {
    const content = await create.execute(input({ status: ContentStatus.PUBLISHED }));

    expect(content.publishedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["missing", "category-unknown"],
    ["inactive", "category-inactive"],
  ])("rejects a %s category with 404", async (_label, categoryId) => {
    await expectAppError(create.execute(input({ categoryId })), 404);
  });

  it("rejects a title without letters or digits with 422", async () => {
    await expectAppError(create.execute(input({ title: "!!!" })), 422);
  });

  it("rejects a slug already in use with 409", async () => {
    await create.execute(input());

    await expectAppError(create.execute(input({ title: "Como Descartar Plastico" })), 409);
  });

  it("rejects featuring content that is not published with 422", async () => {
    await expectAppError(create.execute(input({ featured: true })), 422);
  });

  it("keeps a single featured content", async () => {
    const first = await create.execute(
      input({ title: "Primeiro", status: ContentStatus.PUBLISHED, featured: true }),
    );
    const second = await create.execute(
      input({ title: "Segundo", status: ContentStatus.PUBLISHED, featured: true }),
    );

    expect((await repository.findById(first.id))?.featured).toBe(false);
    expect((await repository.findFeatured())?.id).toBe(second.id);
  });
});

describe("UpdateEducationalContentUseCase", () => {
  it("answers 404 for unknown content", async () => {
    await expectAppError(update.execute("content-unknown", { title: "Novo" }), 404);
  });

  it("rejects moving the content to an inactive category with 404", async () => {
    const content = await create.execute(input());

    await expectAppError(update.execute(content.id, { categoryId: "category-inactive" }), 404);
  });

  it("rejects a slug owned by another content with 409", async () => {
    await create.execute(input({ title: "Primeiro" }));
    const second = await create.execute(input({ title: "Segundo" }));

    await expectAppError(update.execute(second.id, { slug: "primeiro" }), 409);
  });

  it("accepts resending the content's own slug", async () => {
    const content = await create.execute(input());

    await expect(update.execute(content.id, { slug: content.slug })).resolves.toMatchObject({
      slug: content.slug,
    });
  });

  it("rejects featuring a draft with 422", async () => {
    const content = await create.execute(input());

    await expectAppError(update.execute(content.id, { featured: true }), 422);
  });

  it("stamps the first publication date and keeps it when republishing", async () => {
    const content = await create.execute(input());

    const published = await update.execute(content.id, { status: ContentStatus.PUBLISHED });
    await update.execute(content.id, { status: ContentStatus.DRAFT });
    const republished = await update.execute(content.id, { status: ContentStatus.PUBLISHED });

    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(republished.publishedAt).toBe(published.publishedAt);
  });

  it("removes the featured flag when the content leaves the published state", async () => {
    const content = await create.execute(
      input({ status: ContentStatus.PUBLISHED, featured: true }),
    );

    const updated = await update.execute(content.id, { status: ContentStatus.PENDING_REVIEW });

    expect(updated.featured).toBe(false);
  });
});

describe("public and admin reads", () => {
  it("hides drafts from the public detail with 404", async () => {
    const content = await create.execute(input());

    await expectAppError(
      new FindEducationalContentByIdUseCase(repository).execute(content.id),
      404,
    );
  });

  it("counts a view on each public read", async () => {
    const content = await create.execute(input({ status: ContentStatus.PUBLISHED }));
    const findPublic = new FindEducationalContentByIdUseCase(repository);

    await findPublic.execute(content.id);
    const second = await findPublic.execute(content.id);

    expect(second.viewCount).toBe(2);
    expect((await repository.findById(content.id))?.viewCount).toBe(2);
  });

  it("lets the admin open a draft without counting a view", async () => {
    const content = await create.execute(input());

    const managed = await new FindManagedEducationalContentUseCase(repository).execute(content.id);

    expect(managed.status).toBe(ContentStatus.DRAFT);
    expect((await repository.findById(content.id))?.viewCount).toBe(0);
  });

  it("answers 404 when nothing is featured", async () => {
    await expectAppError(new GetFeaturedEducationalContentUseCase(repository).execute(), 404);
  });

  it("counts the stats from the first day of the current month", async () => {
    await new GetEducationalContentStatsUseCase(repository).execute(new Date(2026, 10, 18, 15, 30));

    expect(repository.getStats).toHaveBeenCalledWith(new Date(2026, 10, 1));
  });
});
