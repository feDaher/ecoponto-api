import { prisma } from "../../../../config/prisma";
import type { Prisma } from "../../../../generated/prisma/client";
import { DisposalStatus, Role } from "../../../../generated/prisma/enums";
import type { CitizenScore, RankingFilters } from "../../domain/entities/RankingEntry";
import type { IRankingRepository } from "../../domain/repositories/IRankingRepository";

// Only active citizens compete; `city` uses the column collation (case/accent-insensitive).
function rankedDisposals({ city }: RankingFilters): Prisma.DisposalRecordWhereInput {
  return {
    status: DisposalStatus.CONFIRMED,
    citizen: { role: Role.CITIZEN, isBlocked: false, ...(city ? { city } : {}) },
  };
}

export class PrismaRankingRepository implements IRankingRepository {
  async findTopScores(filters: RankingFilters, limit: number): Promise<CitizenScore[]> {
    const groups = await prisma.disposalRecord.groupBy({
      by: ["citizenId"],
      where: rankedDisposals(filters),
      _sum: { pointsEarned: true },
      having: { pointsEarned: { _sum: { gt: 0 } } },
      orderBy: [{ _sum: { pointsEarned: "desc" } }, { citizenId: "asc" }],
      take: limit,
    });

    const citizens = await prisma.user.findMany({
      where: { id: { in: groups.map((group) => group.citizenId) } },
      select: { id: true, name: true, city: true },
    });
    const byId = new Map(citizens.map((citizen) => [citizen.id, citizen]));

    return groups.flatMap((group) => {
      const citizen = byId.get(group.citizenId);
      if (!citizen) return [];

      return [
        {
          citizenId: citizen.id,
          name: citizen.name,
          city: citizen.city,
          points: group._sum.pointsEarned ?? 0,
        },
      ];
    });
  }

  async sumConfirmedPoints(citizenId: string): Promise<number> {
    const total = await prisma.disposalRecord.aggregate({
      where: { citizenId, status: DisposalStatus.CONFIRMED },
      _sum: { pointsEarned: true },
    });

    return total._sum?.pointsEarned ?? 0;
  }

  async countAbove(points: number, filters: RankingFilters): Promise<number> {
    const above = await prisma.disposalRecord.groupBy({
      by: ["citizenId"],
      where: rankedDisposals(filters),
      having: { pointsEarned: { _sum: { gt: points } } },
    });

    return above.length;
  }
}
