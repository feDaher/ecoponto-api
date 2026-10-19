-- AlterTable
ALTER TABLE `CollectionPoint` MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `WasteCategory` ADD COLUMN `description` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `OperatingHours` (
    `id` VARCHAR(191) NOT NULL,
    `collectionPointId` VARCHAR(191) NOT NULL,
    `weekday` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `openTime` TIME(0) NOT NULL,
    `closeTime` TIME(0) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperatingHours_collectionPointId_idx`(`collectionPointId`),
    INDEX `OperatingHours_weekday_idx`(`weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Geolocation` (
    `id` VARCHAR(191) NOT NULL,
    `collectionPointId` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `neighborhood` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `postalCode` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Geolocation_collectionPointId_key`(`collectionPointId`),
    INDEX `Geolocation_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Collection` (
    `id` VARCHAR(191) NOT NULL,
    `collectorId` VARCHAR(191) NOT NULL,
    `collectionPointId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `totalWeightKg` DECIMAL(10, 3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Collection_collectorId_idx`(`collectorId`),
    INDEX `Collection_collectionPointId_idx`(`collectionPointId`),
    INDEX `Collection_collectionPointId_scheduledAt_idx`(`collectionPointId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DisposalRecord` (
    `id` VARCHAR(191) NOT NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `collectionPointId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `collectionId` VARCHAR(191) NULL,
    `weightKg` DECIMAL(10, 3) NOT NULL,
    `pointsEarned` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `disposedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DisposalRecord_citizenId_idx`(`citizenId`),
    INDEX `DisposalRecord_collectionPointId_idx`(`collectionPointId`),
    INDEX `DisposalRecord_categoryId_idx`(`categoryId`),
    INDEX `DisposalRecord_collectionId_idx`(`collectionId`),
    INDEX `DisposalRecord_disposedAt_status_idx`(`disposedAt`, `status`),
    INDEX `DisposalRecord_collectionPointId_disposedAt_idx`(`collectionPointId`, `disposedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `collectionPointId` VARCHAR(191) NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Review_citizenId_idx`(`citizenId`),
    INDEX `Review_collectionPointId_idx`(`collectionPointId`),
    INDEX `Review_collectionPointId_createdAt_idx`(`collectionPointId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OperatingHours` ADD CONSTRAINT `OperatingHours_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Geolocation` ADD CONSTRAINT `Geolocation_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Collection` ADD CONSTRAINT `Collection_collectorId_fkey` FOREIGN KEY (`collectorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Collection` ADD CONSTRAINT `Collection_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `WasteCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints (definidas na modelagem do BD02; o Prisma não as declara no schema)
ALTER TABLE `Geolocation` ADD CONSTRAINT `Geolocation_latitude_check` CHECK (`latitude` BETWEEN -90 AND 90);
ALTER TABLE `Geolocation` ADD CONSTRAINT `Geolocation_longitude_check` CHECK (`longitude` BETWEEN -180 AND 180);
ALTER TABLE `Collection` ADD CONSTRAINT `Collection_totalWeightKg_check` CHECK (`totalWeightKg` IS NULL OR `totalWeightKg` >= 0);
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_weightKg_check` CHECK (`weightKg` > 0);
ALTER TABLE `DisposalRecord` ADD CONSTRAINT `DisposalRecord_pointsEarned_check` CHECK (`pointsEarned` >= 0);
ALTER TABLE `Review` ADD CONSTRAINT `Review_rating_check` CHECK (`rating` BETWEEN 1 AND 5);
