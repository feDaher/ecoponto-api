-- CreateTable
CREATE TABLE `PlacesApiUsage` (
    `sku` VARCHAR(40) NOT NULL,
    `day` CHAR(10) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`sku`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
