-- CreateTable
CREATE TABLE `EducationalContent` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EducationalContent` ADD CONSTRAINT `EducationalContent_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `WasteCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
