-- Backfill the normalized join table before removing the legacy JSON column.
-- Existing codes are matched against WasteCategory.name; inactive categories are
-- included so historical point/category associations are preserved.
-- Some databases may have points but no seeded category catalog yet. Create
-- missing historical codes so the backfill remains self-contained and lossless.
INSERT INTO `WasteCategory` (`id`, `name`, `description`, `active`, `createdAt`, `updatedAt`)
SELECT UUID(), `legacyCodes`.`code`, NULL, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT DISTINCT `legacyCategory`.`code`
    FROM `CollectionPoint`
    JOIN JSON_TABLE(
        `CollectionPoint`.`wasteCategories`,
        '$[*]' COLUMNS (`code` VARCHAR(191) PATH '$')
    ) AS `legacyCategory`
    WHERE `legacyCategory`.`code` IS NOT NULL
) AS `legacyCodes`
LEFT JOIN `WasteCategory`
    ON CONVERT(`WasteCategory`.`name` USING utf8mb4) COLLATE utf8mb4_unicode_ci =
       CONVERT(`legacyCodes`.`code` USING utf8mb4) COLLATE utf8mb4_unicode_ci
WHERE `WasteCategory`.`id` IS NULL;

INSERT INTO `PointCategory` (`pointId`, `categoryId`)
SELECT DISTINCT `CollectionPoint`.`id`, `WasteCategory`.`id`
FROM `CollectionPoint`
JOIN JSON_TABLE(
    `CollectionPoint`.`wasteCategories`,
    '$[*]' COLUMNS (`code` VARCHAR(191) PATH '$')
) AS `legacyCategory`
LEFT JOIN `WasteCategory`
    ON CONVERT(`WasteCategory`.`name` USING utf8mb4) COLLATE utf8mb4_unicode_ci =
       CONVERT(`legacyCategory`.`code` USING utf8mb4) COLLATE utf8mb4_unicode_ci
UNION ALL
-- Force malformed non-array legacy values to fail on the NOT NULL FK column,
-- rather than silently deleting data when the old column is dropped.
SELECT `CollectionPoint`.`id`, NULL
FROM `CollectionPoint`
WHERE JSON_TYPE(`CollectionPoint`.`wasteCategories`) <> 'ARRAY';

-- Unknown category codes produce NULL above and fail this insert; the JSON
-- column remains available for correction because the DROP has not run yet.
ALTER TABLE `CollectionPoint` DROP COLUMN `wasteCategories`;
