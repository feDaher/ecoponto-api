CREATE TABLE `CollectionPointConfiguration` (
    `collectionPointId` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `streetNumber` VARCHAR(20) NOT NULL,
    `neighborhood` VARCHAR(191) NOT NULL,
    `state` CHAR(2) NOT NULL,
    `postalCode` VARCHAR(8) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`collectionPointId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CooperativeProfile` (
    `collectorId` VARCHAR(191) NOT NULL,
    `cooperativeName` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(14) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`collectorId`),
    INDEX `CooperativeProfile_cnpj_idx` (`cnpj`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CollectionPointConfiguration` ADD CONSTRAINT `CollectionPointConfiguration_collectionPointId_fkey` FOREIGN KEY (`collectionPointId`) REFERENCES `CollectionPoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CooperativeProfile` ADD CONSTRAINT `CooperativeProfile_collectorId_fkey` FOREIGN KEY (`collectorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
