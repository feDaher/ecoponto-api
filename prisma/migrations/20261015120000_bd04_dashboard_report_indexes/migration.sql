-- BD-04: indices para dashboard (BE-07) e relatorios (BE-08)

-- CreateIndex
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);

-- CreateIndex
CREATE INDEX `DisposalRecord_report_cov_idx` ON `DisposalRecord`(`status`, `disposedAt`, `categoryId`, `weightKg`, `pointsEarned`);