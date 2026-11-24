-- CreateTable
CREATE TABLE `PointCategoryReview` (
    `id` VARCHAR(191) NOT NULL,
    `pointId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PointCategoryReview_pointId_reviewedAt_idx`(`pointId`, `reviewedAt`),
    INDEX `PointCategoryReview_categoryId_idx`(`categoryId`),
    INDEX `PointCategoryReview_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PointCategoryReview` ADD CONSTRAINT `PointCategoryReview_pointId_fkey` FOREIGN KEY (`pointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointCategoryReview` ADD CONSTRAINT `PointCategoryReview_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `WasteCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointCategoryReview` ADD CONSTRAINT `PointCategoryReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
