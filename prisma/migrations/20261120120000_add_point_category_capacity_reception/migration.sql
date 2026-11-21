ALTER TABLE `PointCategory`
    ADD COLUMN `capacityKg` DECIMAL(10, 3) NULL,
    ADD COLUMN `isAccepting` BOOLEAN NOT NULL DEFAULT true;
