import type { Request, Response } from "express";
import { GetMyRankingUseCase } from "../domain/use-cases/GetMyRankingUseCase";
import { GetRankingUseCase } from "../domain/use-cases/GetRankingUseCase";
import { PrismaRankingRepository } from "../infra/repositories/PrismaRankingRepository";
import type { MyRankingQuery, RankingQuery } from "./ranking.validators";

const rankingRepository = new PrismaRankingRepository();
const getRankingUseCase = new GetRankingUseCase(rankingRepository);
const getMyRankingUseCase = new GetMyRankingUseCase(rankingRepository);

export async function getRanking(req: Request, res: Response) {
  // `validate(..., "query")` already replaced req.query with the parsed values.
  const { city, limit } = req.query as unknown as RankingQuery;

  const ranking = await getRankingUseCase.execute({ city, limit });
  res.status(200).json(ranking);
}

export async function getMyRanking(req: Request, res: Response) {
  const { city } = req.query as unknown as MyRankingQuery;

  const { id, name = "", city: citizenCity = "" } = req.user!;

  const standing = await getMyRankingUseCase.execute({
    citizen: { id, name, city: citizenCity },
    city,
  });
  res.status(200).json(standing);
}
