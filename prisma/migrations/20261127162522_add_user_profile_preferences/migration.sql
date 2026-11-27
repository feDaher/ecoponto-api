-- AlterTable
ALTER TABLE `User` ADD COLUMN `allowCooperativeContact` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cooperativeContactConsentAt` DATETIME(3) NULL,
    ADD COLUMN `nickname` VARCHAR(60) NULL,
    ADD COLUMN `notifyCollectionAlerts` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyMonthlyReports` BOOLEAN NOT NULL DEFAULT true;
