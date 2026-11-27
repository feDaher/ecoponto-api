/*
  Warnings:

  - A unique constraint covering the columns `[citizenId,collectionPointId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Review_citizenId_collectionPointId_key` ON `Review`(`citizenId`, `collectionPointId`);
