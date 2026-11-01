-- 1) Copia o JSON para a tabela (só pontos que ainda não têm linhas em OperatingHours)
INSERT INTO `OperatingHours`
  (`id`, `collectionPointId`, `weekday`, `openTime`, `closeTime`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  UUID(), cp.`id`, jt.`weekday`, jt.`openTime`, jt.`closeTime`, true, NOW(3), NOW(3)
FROM `CollectionPoint` cp
JOIN JSON_TABLE(
  cp.`operatingHours`,
  '$[*]' COLUMNS (
    `weekday`   VARCHAR(10) PATH '$.weekday',
    `openTime`  TIME        PATH '$.openTime',
    `closeTime` TIME        PATH '$.closeTime'
  )
) AS jt
WHERE NOT EXISTS (
  SELECT 1 FROM `OperatingHours` oh WHERE oh.`collectionPointId` = cp.`id`
);

-- 2) Remove a coluna (esta linha o Prisma já gerou)
ALTER TABLE `CollectionPoint` DROP COLUMN `operatingHours`;