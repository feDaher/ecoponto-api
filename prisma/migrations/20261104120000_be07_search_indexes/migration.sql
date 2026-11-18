-- DropIndex
DROP INDEX `CollectionPoint_status_city_idx` ON `CollectionPoint`;

-- CreateIndex
CREATE INDEX `CollectionPoint_status_name_idx` ON `CollectionPoint`(`status`, `name`);

-- CreateIndex
CREATE INDEX `CollectionPoint_status_city_name_idx` ON `CollectionPoint`(`status`, `city`, `name`);

-- CreateIndex
CREATE INDEX `CollectionPoint_status_latitude_longitude_idx` ON `CollectionPoint`(`status`, `latitude`, `longitude`);
