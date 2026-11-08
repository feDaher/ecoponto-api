-- AlterTable
ALTER TABLE `EducationalContent` ADD COLUMN `coverImageUrl` VARCHAR(1000) NULL,
    ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `format` ENUM('DISPOSAL_GUIDE', 'DIY_TUTORIAL', 'QUICK_FACT', 'COMMUNITY_EVENT') NOT NULL DEFAULT 'DISPOSAL_GUIDE',
    ADD COLUMN `level` ENUM('ESSENTIAL', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'ESSENTIAL',
    ADD COLUMN `publishedAt` DATETIME(3) NULL,
    ADD COLUMN `readingTimeMinutes` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `summary` VARCHAR(500) NOT NULL,
    ADD COLUMN `viewCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `xpReward` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX `EducationalContent_slug_key` ON `EducationalContent`(`slug`);

-- CreateIndex
CREATE INDEX `EducationalContent_status_idx` ON `EducationalContent`(`status`);

-- CreateIndex
CREATE INDEX `EducationalContent_format_idx` ON `EducationalContent`(`format`);

-- CreateIndex
CREATE INDEX `EducationalContent_featured_idx` ON `EducationalContent`(`featured`);
