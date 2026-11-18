-- 1) Copia o JSON para a tabela, pulando só os horários que já existem iguais em OperatingHours
INSERT INTO `OperatingHours`
  (`id`, `collectionPointId`, `weekday`, `openTime`, `closeTime`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  UUID(), json_hours.`pointId`, json_hours.`weekday`, json_hours.`openTime`, json_hours.`closeTime`, true, NOW(3), NOW(3)
FROM (
  SELECT DISTINCT cp.`id` AS `pointId`, jt.`weekday`, jt.`openTime`, jt.`closeTime`
  FROM `CollectionPoint` cp
  JOIN JSON_TABLE(
    cp.`operatingHours`,
    '$[*]' COLUMNS (
      `weekday`   VARCHAR(10) PATH '$.weekday',
      `openTime`  TIME        PATH '$.openTime',
      `closeTime` TIME        PATH '$.closeTime'
    )
  ) AS jt
) AS json_hours
WHERE NOT EXISTS (
  SELECT 1 FROM `OperatingHours` oh
  WHERE oh.`collectionPointId` = json_hours.`pointId`
    AND oh.`weekday` = json_hours.`weekday` COLLATE utf8mb4_unicode_ci
    AND oh.`openTime` = json_hours.`openTime`
    AND oh.`closeTime` = json_hours.`closeTime`
);

-- 2) Remove a coluna (esta linha o Prisma já gerou)
ALTER TABLE `CollectionPoint` DROP COLUMN `operatingHours`;
