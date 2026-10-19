-- AlterTable
ALTER TABLE `CollectionPoint` ADD COLUMN `hoursConfirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isOutdated` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EducationalContent` MODIFY `content` TEXT NOT NULL;

-- CreateIndex
CREATE INDEX `CollectionPoint_isOutdated_hoursConfirmedAt_idx` ON `CollectionPoint`(`isOutdated`, `hoursConfirmedAt`);

-- RenameIndex
ALTER TABLE `EducationalContent` RENAME INDEX `EducationalContent_categoryId_fkey` TO `EducationalContent_categoryId_idx`;
