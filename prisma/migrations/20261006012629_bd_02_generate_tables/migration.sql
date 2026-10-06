/*
  Warnings:

  - You are about to drop the `Collection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CollectionPoint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DisposalRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Geolocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OperatingHours` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WasteCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Collection` DROP FOREIGN KEY `Collection_collectionPointId_fkey`;

-- DropForeignKey
ALTER TABLE `Collection` DROP FOREIGN KEY `Collection_collectorId_fkey`;

-- DropForeignKey
ALTER TABLE `CollectionPoint` DROP FOREIGN KEY `CollectionPoint_collectorId_fkey`;

-- DropForeignKey
ALTER TABLE `DisposalRecord` DROP FOREIGN KEY `DisposalRecord_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `DisposalRecord` DROP FOREIGN KEY `DisposalRecord_citizenId_fkey`;

-- DropForeignKey
ALTER TABLE `DisposalRecord` DROP FOREIGN KEY `DisposalRecord_collectionId_fkey`;

-- DropForeignKey
ALTER TABLE `DisposalRecord` DROP FOREIGN KEY `DisposalRecord_collectionPointId_fkey`;

-- DropForeignKey
ALTER TABLE `Geolocation` DROP FOREIGN KEY `Geolocation_collectionPointId_fkey`;

-- DropForeignKey
ALTER TABLE `OperatingHours` DROP FOREIGN KEY `OperatingHours_collectionPointId_fkey`;

-- DropForeignKey
ALTER TABLE `Review` DROP FOREIGN KEY `Review_citizenId_fkey`;

-- DropForeignKey
ALTER TABLE `Review` DROP FOREIGN KEY `Review_collectionPointId_fkey`;

-- DropTable
DROP TABLE `Collection`;

-- DropTable
DROP TABLE `CollectionPoint`;

-- DropTable
DROP TABLE `DisposalRecord`;

-- DropTable
DROP TABLE `Geolocation`;

-- DropTable
DROP TABLE `OperatingHours`;

-- DropTable
DROP TABLE `Review`;

-- DropTable
DROP TABLE `WasteCategory`;
