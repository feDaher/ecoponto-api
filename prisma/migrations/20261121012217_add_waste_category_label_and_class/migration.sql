-- AlterTable
ALTER TABLE `WasteCategory` ADD COLUMN `label` VARCHAR(191) NULL,
    ADD COLUMN `wasteClass` ENUM('CLASS_I', 'CLASS_IIA', 'CLASS_IIB') NULL;
