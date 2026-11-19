import { prisma } from "../config/prisma";
import {
  CollectionPointStatus,
  ContentStatus,
  DisposalStatus,
  type Weekday,
} from "../generated/prisma/enums";
import { calculatePoints } from "../modules/disposals/domain/rules/points-rules";
import { toTime } from "../shared/time/time-of-day";

/**
 * Demo data for the apps: approved collection points in Manhuaçu, published educational
 * guides, a few reviews and confirmed disposals (so the ranking is not empty).
 *
 * Mirrors the mobile app's offline demo (`src/infrastructure/seed/demo-data.ts` there), so the
 * map looks the same with or without the API. None of these places or phone numbers is real.
 *
 * Idempotent and non-destructive: every row has a fixed id (valid UUIDs, the routes validate
 * them) and is only created when missing — edits made through the panels are never overwritten.
 */

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const WEEKDAYS: Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** `[weekday (0 = Sunday), open, close]` */
type Slot = [number, string, string];

const weekdays = (open: string, close: string): Slot[] =>
  [1, 2, 3, 4, 5].map((day) => [day, open, close]);

const seedId = (kind: number, n: number) =>
  `5eed000${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;

interface DemoPoint {
  n: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categories: string[];
  hours: Slot[];
  description: string;
  whatsappContact: string | null;
  showWhatsappContact: boolean;
  status: CollectionPointStatus;
  hoursConfirmedDaysAgo: number;
}

const DEMO_POINTS: DemoPoint[] = [
  {
    n: 1,
    name: "Cooperativa Recicla Manhuaçu",
    address: "Rua Ministro Alfredo Sá, 320 — Centro",
    latitude: -20.2585,
    longitude: -42.0296,
    categories: ["PLASTIC", "PAPER", "METALS", "GLASS"],
    hours: [...weekdays("08:00", "18:00"), [6, "08:00", "12:00"]],
    description:
      "Cooperativa de catadores com triagem completa de recicláveis secos. Receba orientação sobre separação na entrada.",
    whatsappContact: "33999990011",
    showWhatsappContact: true,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 3,
  },
  {
    n: 2,
    name: "UniFacig — Coleta de Eletrônicos",
    address: "Av. Getúlio Vargas, 150 — Coqueiro",
    latitude: -20.2632,
    longitude: -42.0338,
    categories: ["ELECTRONICS", "COMPUTERS", "CELL_PHONES", "PRINTERS", "BATTERIES"],
    hours: weekdays("13:00", "22:00"),
    description:
      "Ponto de recebimento de eletrônicos no campus, mantido pelo curso de ADS em parceria com uma recicladora licenciada.",
    whatsappContact: "33999990022",
    showWhatsappContact: true,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 1,
  },
  {
    n: 3,
    name: "Ponto Verde São Vicente",
    address: "Rua São Vicente, 87 — São Vicente",
    latitude: -20.2497,
    longitude: -42.0224,
    categories: ["COOKING_OIL", "GLASS", "PLASTIC"],
    hours: [
      [2, "09:00", "17:00"],
      [4, "09:00", "17:00"],
      [6, "09:00", "13:00"],
    ],
    description: "Recebe óleo de cozinha em garrafa PET fechada, vidros e plásticos limpos.",
    whatsappContact: "33999990033",
    showWhatsappContact: false,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 12,
  },
  {
    n: 4,
    name: "Supermercado Bom Preço — Coleta de Pilhas",
    address: "Praça Cinco de Novembro, 44 — Centro",
    latitude: -20.2561,
    longitude: -42.0269,
    categories: ["BATTERIES", "CELL_PHONES"],
    hours: [
      [0, "08:00", "13:00"],
      ...[1, 2, 3, 4, 5, 6].map((day): Slot => [day, "07:00", "21:00"]),
    ],
    description: "Coletor de pilhas e baterias na entrada da loja, ao lado dos caixas.",
    whatsappContact: null,
    showWhatsappContact: false,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 20,
  },
  {
    // RB06: hours not confirmed for more than 60 days → flagged as possibly outdated.
    n: 5,
    name: "TecnoLar Assistência Técnica",
    address: "Rua Dr. Luís Dutra, 512 — Baixada",
    latitude: -20.2649,
    longitude: -42.0197,
    categories: ["TELEVISIONS", "ELECTRONICS", "PRINTERS"],
    hours: weekdays("08:00", "18:00"),
    description: "Recebe televisores e eletrodomésticos de pequeno porte para desmontagem.",
    whatsappContact: "33999990055",
    showWhatsappContact: true,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 95,
  },
  {
    n: 6,
    name: "Escola Municipal Santa Luzia",
    address: "Rua das Palmeiras, 90 — Santa Luzia",
    latitude: -20.2704,
    longitude: -42.0412,
    categories: ["PAPER", "PLASTIC", "METALS"],
    hours: [
      [1, "07:00", "17:00"],
      [3, "07:00", "17:00"],
      [5, "07:00", "17:00"],
    ],
    description: "Campanha permanente de arrecadação de recicláveis com os alunos.",
    whatsappContact: null,
    showWhatsappContact: false,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 8,
  },
  {
    n: 7,
    name: "EcoPonto Realeza",
    address: "Av. Salime Nacif, 1200 — Realeza",
    latitude: -20.2455,
    longitude: -42.0345,
    categories: ["PLASTIC", "PAPER", "GLASS", "METALS", "COOKING_OIL", "ELECTRONICS"],
    hours: [...weekdays("08:00", "18:00"), [6, "08:00", "16:00"], [0, "08:00", "12:00"]],
    description:
      "Ecoponto municipal com caçambas separadas por tipo de resíduo e atendimento aos fins de semana.",
    whatsappContact: "33999990077",
    showWhatsappContact: true,
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedDaysAgo: 30,
  },
  {
    // RB03: waiting for the administrator — must not appear on the map.
    n: 8,
    name: "Ponto de Coleta Vila Nova (em análise)",
    address: "Rua Projetada, s/n — Vila Nova",
    latitude: -20.2388,
    longitude: -42.0158,
    categories: ["PLASTIC", "PAPER"],
    hours: [[6, "09:00", "12:00"]],
    description: "Cadastro enviado pelo coletor, aguardando validação do administrador.",
    whatsappContact: "33999990088",
    showWhatsappContact: true,
    status: CollectionPointStatus.PENDING,
    hoursConfirmedDaysAgo: 2,
  },
];

interface DemoGuide {
  n: number;
  category: string;
  title: string;
  summary: string;
  steps: string[];
  whyRecycle: string;
  impact: string;
  publishedDaysAgo: number;
  featured?: boolean;
}

const DEMO_GUIDES: DemoGuide[] = [
  {
    n: 1,
    category: "BATTERIES",
    title: "Como descartar pilhas e baterias com segurança",
    summary:
      "Pilhas contêm metais pesados que contaminam solo e lençol freático. Nunca vão no lixo comum.",
    steps: [
      "Guarde as pilhas usadas em um pote plástico seco, longe de crianças.",
      "Não desmonte, não fure e não queime as pilhas.",
      "Leve a um ponto com coletor específico para pilhas e baterias.",
    ],
    whyRecycle:
      "Uma única pilha pode contaminar milhares de litros de água ao se decompor em aterro comum.",
    impact:
      "Metais como mercúrio, chumbo e cádmio são bioacumulativos: sobem a cadeia alimentar até chegar às pessoas.",
    publishedDaysAgo: 30,
  },
  {
    n: 2,
    category: "CELL_PHONES",
    title: "O que fazer com o celular que você não usa mais",
    summary:
      "Mais de 83% dos entrevistados em Manhuaçu guardam eletrônicos em casa. O celular é o campeão da gaveta.",
    steps: [
      "Faça backup e apague os dados com restauração de fábrica.",
      "Remova chip e cartão de memória.",
      "Entregue em um ponto que aceite celulares — a bateria exige manejo especial.",
    ],
    whyRecycle:
      "Um celular contém ouro, prata, cobre e terras raras recuperáveis, além de componentes tóxicos.",
    impact:
      "Reciclar uma tonelada de celulares recupera mais ouro do que uma tonelada de minério bruto.",
    publishedDaysAgo: 25,
    featured: true,
  },
  {
    n: 3,
    category: "COOKING_OIL",
    title: "Óleo de cozinha usado: nunca na pia",
    summary:
      "Um litro de óleo contamina até 25 mil litros de água quando descartado na rede de esgoto.",
    steps: [
      "Espere esfriar e coe para remover resíduos de comida.",
      "Armazene em garrafa PET bem fechada.",
      "Entregue em um ponto que receba óleo — ele vira sabão e biodiesel.",
    ],
    whyRecycle: "O óleo forma película na água e impede a oxigenação da vida aquática.",
    impact:
      "Além da contaminação, o óleo entope a rede de esgoto e aumenta o custo do tratamento municipal.",
    publishedDaysAgo: 18,
  },
  {
    n: 4,
    category: "PLASTIC",
    title: "Separação correta de plástico, papel, vidro e metal",
    summary: "A regra é simples: limpo, seco e separado. Resíduo sujo contamina o lote inteiro.",
    steps: [
      "Enxágue embalagens com resto de alimento.",
      "Achate caixas e garrafas para ocupar menos espaço.",
      "Separe vidro quebrado em papelão identificado, protegendo quem coleta.",
    ],
    whyRecycle:
      "Material reciclado consome muito menos energia que a produção a partir de matéria-prima virgem.",
    impact: "Reciclar alumínio economiza cerca de 95% da energia usada para produzi-lo do zero.",
    publishedDaysAgo: 10,
  },
  {
    n: 5,
    category: "COMPUTERS",
    title: "Computadores e impressoras: descarte com responsabilidade",
    summary: "Equipamentos de informática têm componentes perigosos e materiais valiosos.",
    steps: [
      "Remova e destrua com segurança discos com dados pessoais (LGPD).",
      "Não descarte monitores de tubo no lixo comum — contêm chumbo.",
      "Entregue em ponto habilitado para eletrônicos de grande porte.",
    ],
    whyRecycle:
      "Placas eletrônicas concentram cobre e ouro, e seu descarte incorreto libera retardantes de chama.",
    impact:
      "O lixo eletrônico é o fluxo de resíduos que mais cresce no mundo, e menos de um quarto é reciclado.",
    publishedDaysAgo: 5,
  },
];

/**
 * The guide body as Markdown with three fixed headings. The mobile app splits it back into
 * "how to dispose" steps, "why recycle" and "environmental impact"; the web panel shows it as is.
 */
function guideContent({ steps, whyRecycle, impact }: DemoGuide): string {
  return [
    "## Como descartar",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Por que reciclar",
    whyRecycle,
    "",
    "## Impacto ambiental",
    impact,
  ].join("\n");
}

const DEMO_REVIEWS = [
  { n: 1, point: 1, rating: 5, comment: "Equipe atenciosa, explicaram como separar o material." },
  { n: 2, point: 2, rating: 4, comment: "Ótimo para descartar celular antigo. Só abre à tarde." },
  { n: 3, point: 7, rating: 5, comment: null },
];

const DEMO_DISPOSALS = [
  { n: 1, point: 2, category: "CELL_PHONES", weightKg: 0.4, daysAgo: 20 },
  { n: 2, point: 1, category: "PLASTIC", weightKg: 3.5, daysAgo: 12 },
  { n: 3, point: 3, category: "COOKING_OIL", weightKg: 2, daysAgo: 6 },
  { n: 4, point: 4, category: "BATTERIES", weightKg: 0.3, daysAgo: 2 },
];

export interface DemoSeedAccounts {
  adminId: string;
  collectorId: string;
  citizenId: string;
}

export async function seedDemoData({ adminId, collectorId, citizenId }: DemoSeedAccounts) {
  const categories = await prisma.wasteCategory.findMany({ select: { id: true, name: true } });
  const categoryId = new Map(categories.map(({ id, name }) => [name, id]));
  const categoryOf = (code: string) => {
    const id = categoryId.get(code);
    if (!id) throw new Error(`Seed: unknown waste category ${code}`);
    return id;
  };

  let created = 0;

  for (const point of DEMO_POINTS) {
    const id = seedId(1, point.n);
    if (await prisma.collectionPoint.findUnique({ where: { id }, select: { id: true } })) continue;

    const approved = point.status === CollectionPointStatus.APPROVED;
    const hoursConfirmedAt = daysAgo(point.hoursConfirmedDaysAgo);

    await prisma.collectionPoint.create({
      data: {
        id,
        collectorId,
        name: point.name,
        description: point.description,
        city: "Manhuaçu",
        address: point.address,
        latitude: point.latitude,
        longitude: point.longitude,
        whatsappContact: point.whatsappContact,
        showWhatsappContact: point.showWhatsappContact,
        status: point.status,
        reviewedById: approved ? adminId : null,
        reviewedAt: approved ? hoursConfirmedAt : null,
        hoursConfirmedAt,
        isOutdated: point.hoursConfirmedDaysAgo > 60,
        categories: { create: point.categories.map((code) => ({ categoryId: categoryOf(code) })) },
        hours: {
          create: point.hours.map(([day, open, close]) => ({
            weekday: WEEKDAYS[day],
            openTime: toTime(open),
            closeTime: toTime(close),
          })),
        },
      },
    });
    created += 1;
  }
  console.log(`✔ ${DEMO_POINTS.length} demo collection points (${created} new)`);

  created = 0;
  for (const guide of DEMO_GUIDES) {
    const slug = `demo-${guide.category.toLowerCase().replace(/_/g, "-")}`;
    if (await prisma.educationalContent.findUnique({ where: { slug }, select: { id: true } }))
      continue;

    await prisma.educationalContent.create({
      data: {
        id: seedId(2, guide.n),
        slug,
        title: guide.title,
        summary: guide.summary,
        content: guideContent(guide),
        categoryId: categoryOf(guide.category),
        status: ContentStatus.PUBLISHED,
        featured: guide.featured ?? false,
        publishedAt: daysAgo(guide.publishedDaysAgo),
      },
    });
    created += 1;
  }
  console.log(`✔ ${DEMO_GUIDES.length} demo educational guides (${created} new)`);

  created = 0;
  for (const review of DEMO_REVIEWS) {
    const id = seedId(3, review.n);
    if (await prisma.review.findUnique({ where: { id }, select: { id: true } })) continue;

    await prisma.review.create({
      data: {
        id,
        citizenId,
        collectionPointId: seedId(1, review.point),
        rating: review.rating,
        comment: review.comment,
      },
    });
    created += 1;
  }
  console.log(`✔ ${DEMO_REVIEWS.length} demo reviews (${created} new)`);

  created = 0;
  for (const disposal of DEMO_DISPOSALS) {
    const id = seedId(4, disposal.n);
    if (await prisma.disposalRecord.findUnique({ where: { id }, select: { id: true } })) continue;

    // Already confirmed by the collector, so the points count for the ranking (RB09).
    await prisma.disposalRecord.create({
      data: {
        id,
        citizenId,
        collectionPointId: seedId(1, disposal.point),
        categoryId: categoryOf(disposal.category),
        weightKg: disposal.weightKg,
        pointsEarned: calculatePoints(disposal.weightKg),
        status: DisposalStatus.CONFIRMED,
        disposedAt: daysAgo(disposal.daysAgo),
      },
    });
    created += 1;
  }
  console.log(`✔ ${DEMO_DISPOSALS.length} demo confirmed disposals (${created} new)`);
}
