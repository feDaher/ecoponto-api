-- AlterTable
ALTER TABLE `PointCategory` ADD COLUMN `approvalStatus` ENUM('PENDING', 'APPROVED') NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX `PointCategory_approvalStatus_idx` ON `PointCategory`(`approvalStatus`);
