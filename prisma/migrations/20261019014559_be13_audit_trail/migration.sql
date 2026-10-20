-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropIndex
DROP INDEX `AuditLog_userId_fkey` ON `AuditLog`;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `method` VARCHAR(10) NULL,
    ADD COLUMN `resourceId` VARCHAR(191) NULL,
    ADD COLUMN `route` VARCHAR(191) NULL,
    ADD COLUMN `statusCode` INTEGER NULL,
    MODIFY `userId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_userId_createdAt_idx` ON `AuditLog`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_action_createdAt_idx` ON `AuditLog`(`action`, `createdAt`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
