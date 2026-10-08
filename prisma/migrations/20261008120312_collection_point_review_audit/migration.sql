-- AlterTable
ALTER TABLE `CollectionPoint` ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `CollectionPoint_reviewedById_idx` ON `CollectionPoint`(`reviewedById`);

-- AddForeignKey
ALTER TABLE `CollectionPoint` ADD CONSTRAINT `CollectionPoint_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
