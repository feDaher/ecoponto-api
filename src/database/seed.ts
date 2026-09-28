import type { UserRecord } from "firebase-admin/auth";
import { firebaseAuth } from "../config/firebase";
import { prisma } from "../config/prisma";
import { Role } from "../generated/prisma/enums";

// O projeto Firebase de desenvolvimento é compartilhado pela turma: a senha só é
// aplicada quando a conta é criada. Se ela já existe, o seed apenas reaproveita o uid,
// para que nenhum aluno altere as contas dos outros ao rodar o seed.
const SEED_PASSWORD = "Ecoponto@123";

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

  for (const { name, email, phone, city, role } of seedUsers) {
    const firebaseUser = await findOrCreateFirebaseUser(email, name);

    await prisma.user.upsert({
      where: { email },
      create: { firebaseUid: firebaseUser.uid, name, email, phone, city, role },
      update: { firebaseUid: firebaseUser.uid, name, phone, city, role },
    });

    console.log(`✔ ${role.padEnd(9)} ${email}`);
  }

  console.log(`\nSeed concluído. Senha das contas de teste: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
