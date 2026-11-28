import type { UserRecord } from "firebase-admin/auth";
import { firebaseAuth } from "../config/firebase";
import { prisma } from "../config/prisma";
import { Role, WasteClass } from "../generated/prisma/enums";
import { seedDemoData } from "./seed-demo";

// Senha das contas criadas no Firebase. Localmente é a senha conhecida da turma; num deploy
// público, defina SEED_PASSWORD com uma senha forte (ela não é impressa no terminal).
const DEFAULT_SEED_PASSWORD = "Ecoponto@123";
const customSeedPassword = process.env.SEED_PASSWORD?.trim();
if (customSeedPassword !== undefined && customSeedPassword.length < 12) {
  throw new Error("SEED_PASSWORD must have at least 12 characters");
}
const SEED_PASSWORD = customSeedPassword || DEFAULT_SEED_PASSWORD;

const seedUsers = [
  {
    name: "Admin EcoPonto",
    email: "admin@ecoponto.dev",
    phone: "33999990001",
    city: "Manhuaçu",
    role: Role.ADMIN,
  },
  {
    name: "Cooperativa Recicla Manhuaçu",
    email: "coletor@ecoponto.dev",
    phone: "33999990002",
    city: "Manhuaçu",
    role: Role.COLLECTOR,
  },
  {
    name: "Cidadão Teste",
    email: "cidadao@ecoponto.dev",
    phone: "33999990003",
    city: "Manhuaçu",
    role: Role.CITIZEN,
  },
];

const seedWasteCategories = [
  {
    name: "PLASTIC",
    description: "Plástico",
    label: "Plásticos",
    wasteClass: WasteClass.CLASS_IIA,
  },
  {
    name: "PAPER",
    description: "Papel",
    label: "Papéis e Papelão",
    wasteClass: WasteClass.CLASS_IIA,
  },
  {
    name: "METALS",
    description: "Metais",
    label: "Metais",
    wasteClass: WasteClass.CLASS_IIB,
  },
  {
    name: "GLASS",
    description: "Vidro",
    label: "Vidro",
    wasteClass: WasteClass.CLASS_IIB,
  },
  {
    name: "COOKING_OIL",
    description: "Óleo de cozinha usado",
    label: "Óleo de Cozinha",
    wasteClass: WasteClass.CLASS_IIA,
  },
  {
    name: "ELECTRONICS",
    description: "Eletrônicos em geral",
    label: "Eletrônicos Diversos",
    wasteClass: WasteClass.CLASS_I,
  },
  {
    name: "BATTERIES",
    description: "Pilhas e baterias",
    label: "Baterias, Células de Lítio & Pilhas",
    wasteClass: WasteClass.CLASS_I,
  },
  {
    name: "CELL_PHONES",
    description: "Celulares",
    label: "Smartphones & Telefonia Móvel",
    wasteClass: WasteClass.CLASS_I,
  },
  {
    name: "COMPUTERS",
    description: "Computadores",
    label: "Informática & Placas-Mãe",
    wasteClass: WasteClass.CLASS_I,
  },
  {
    name: "PRINTERS",
    description: "Impressoras",
    label: "Impressoras & Equipamentos de Impressão",
    wasteClass: WasteClass.CLASS_I,
  },
  {
    name: "TELEVISIONS",
    description: "Televisores",
    label: "Monitores, Telas LCD & Tubos CRT",
    wasteClass: WasteClass.CLASS_I,
  },
];

async function findOrCreateFirebaseUser(email: string, displayName: string): Promise<UserRecord> {
  try {
    return await firebaseAuth.getUserByEmail(email);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      return firebaseAuth.createUser({ email, password: SEED_PASSWORD, displayName });
    }

    throw error;
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the seed with NODE_ENV=production");
  }

  await prisma.$transaction(async (tx) => {
    for (const { name, description, label, wasteClass } of seedWasteCategories) {
      const existing = await tx.wasteCategory.findUnique({
        where: { name },
      });

      if (!existing) {
        await tx.wasteCategory.create({
          data: {
            name,
            description,
            label,
            wasteClass,
          },
        });

        continue;
      }

      await tx.wasteCategory.update({
        where: { id: existing.id },
        data: {
          description,
          ...(existing.label === null ? { label } : {}),
          ...(existing.wasteClass === null ? { wasteClass } : {}),
        },
      });
    }
  });

  console.log(`✔ ${seedWasteCategories.length} waste categories`);

  const accountIds = new Map<Role, string>();

  for (const { name, email, phone, city, role } of seedUsers) {
    const firebaseUser = await findOrCreateFirebaseUser(email, name);

    const user = await prisma.user.upsert({
      where: { email },
      create: { firebaseUid: firebaseUser.uid, name, email, phone, city, role },
      update: { firebaseUid: firebaseUser.uid, name, phone, city, role },
    });
    accountIds.set(role, user.id);

    console.log(`✔ ${role.padEnd(9)} ${email}`);
  }

  await seedDemoData({
    adminId: accountIds.get(Role.ADMIN)!,
    collectorId: accountIds.get(Role.COLLECTOR)!,
    citizenId: accountIds.get(Role.CITIZEN)!,
  });

  console.log(
    customSeedPassword
      ? "\nSeed concluído. As contas novas usam a senha definida em SEED_PASSWORD."
      : `\nSeed concluído. Senha das contas de teste: ${SEED_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
