-- =========================================================
-- COLLECTION POINT
-- Ponto de coleta cadastrado por um usuário COLLECTOR
-- =========================================================

CREATE TABLE CollectionPoint (
    id VARCHAR(191) NOT NULL,
    collectorId VARCHAR(191) NOT NULL,

    name VARCHAR(191) NOT NULL,
    city VARCHAR(191) NOT NULL,
    whatsappContact VARCHAR(191) NULL,

    status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED',
        'INACTIVE'
    ) NOT NULL DEFAULT 'PENDING',

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    INDEX CollectionPoint_collectorId_idx(collectorId),
    INDEX CollectionPoint_status_idx(status),

    PRIMARY KEY (id),

    CONSTRAINT CollectionPoint_collectorId_fkey
        FOREIGN KEY (collectorId)
        REFERENCES User(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- WASTE CATEGORY
-- Categoria de resíduo
-- Ex.: PLASTIC, GLASS, PAPER, ELECTRONICS
-- =========================================================

CREATE TABLE WasteCategory (
    id VARCHAR(191) NOT NULL,

    name VARCHAR(191) NOT NULL,
    description VARCHAR(500) NULL,

    isActive BOOLEAN NOT NULL DEFAULT TRUE,

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    UNIQUE INDEX WasteCategory_name_key(name),

    PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- OPERATING HOURS
-- Horários de funcionamento de cada ponto de coleta
-- =========================================================

CREATE TABLE OperatingHours (
    id VARCHAR(191) NOT NULL,
    collectionPointId VARCHAR(191) NOT NULL,

    weekday ENUM(
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY'
    ) NOT NULL,

    openTime TIME NOT NULL,
    closeTime TIME NOT NULL,

    isActive BOOLEAN NOT NULL DEFAULT TRUE,

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    INDEX OperatingHours_collectionPointId_idx(collectionPointId),
    INDEX OperatingHours_weekday_idx(weekday),

    PRIMARY KEY (id),

    CONSTRAINT OperatingHours_collectionPointId_fkey
        FOREIGN KEY (collectionPointId)
        REFERENCES CollectionPoint(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- GEOLOCATION
-- Localização geográfica do ponto de coleta
-- Relação 1:1 com CollectionPoint
-- =========================================================

CREATE TABLE Geolocation (
    id VARCHAR(191) NOT NULL,
    collectionPointId VARCHAR(191) NOT NULL,

    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,

    address VARCHAR(191) NOT NULL,
    neighborhood VARCHAR(191) NULL,
    city VARCHAR(191) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postalCode VARCHAR(20) NULL,

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    UNIQUE INDEX Geolocation_collectionPointId_key(collectionPointId),

    INDEX Geolocation_city_idx(city),

    PRIMARY KEY (id),

    CONSTRAINT Geolocation_collectionPointId_fkey
        FOREIGN KEY (collectionPointId)
        REFERENCES CollectionPoint(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT Geolocation_latitude_check
        CHECK (latitude BETWEEN -90 AND 90),

    CONSTRAINT Geolocation_longitude_check
        CHECK (longitude BETWEEN -180 AND 180)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- COLLECTION
-- Coleta realizada por um coletor em um ponto de coleta
-- =========================================================

CREATE TABLE Collection (
    id VARCHAR(191) NOT NULL,

    collectorId VARCHAR(191) NOT NULL,
    collectionPointId VARCHAR(191) NOT NULL,

    scheduledAt DATETIME(3) NOT NULL,
    startedAt DATETIME(3) NULL,
    completedAt DATETIME(3) NULL,

    totalWeightKg DECIMAL(10,3) NULL,

    notes TEXT NULL,

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    INDEX Collection_collectorId_idx(collectorId),
    INDEX Collection_collectionPointId_idx(collectionPointId),

    INDEX Collection_collectionPointId_scheduledAt_idx(
        collectionPointId,
        scheduledAt
    ),

    PRIMARY KEY (id),

    CONSTRAINT Collection_collectorId_fkey
        FOREIGN KEY (collectorId)
        REFERENCES User(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT Collection_collectionPointId_fkey
        FOREIGN KEY (collectionPointId)
        REFERENCES CollectionPoint(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT Collection_totalWeightKg_check
        CHECK (
            totalWeightKg IS NULL
            OR totalWeightKg >= 0
        )
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- DISPOSAL RECORD
-- Registro de descarte feito por um cidadão
-- =========================================================

CREATE TABLE DisposalRecord (
    id VARCHAR(191) NOT NULL,

    citizenId VARCHAR(191) NOT NULL,
    collectionPointId VARCHAR(191) NOT NULL,
    categoryId VARCHAR(191) NOT NULL,

    -- Pode ser associado posteriormente a uma coleta
    collectionId VARCHAR(191) NULL,

    weightKg DECIMAL(10,3) NOT NULL,

    pointsEarned INT NOT NULL DEFAULT 0,

    status ENUM(
        'PENDING',
        'CONFIRMED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'PENDING',

    disposedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    INDEX DisposalRecord_citizenId_idx(citizenId),
    INDEX DisposalRecord_collectionPointId_idx(collectionPointId),
    INDEX DisposalRecord_categoryId_idx(categoryId),
    INDEX DisposalRecord_collectionId_idx(collectionId),

    INDEX DisposalRecord_disposedAt_status_idx(
        disposedAt,
        status
    ),

    INDEX DisposalRecord_collectionPointId_disposedAt_idx(
        collectionPointId,
        disposedAt
    ),

    PRIMARY KEY (id),

    CONSTRAINT DisposalRecord_citizenId_fkey
        FOREIGN KEY (citizenId)
        REFERENCES User(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT DisposalRecord_collectionPointId_fkey
        FOREIGN KEY (collectionPointId)
        REFERENCES CollectionPoint(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT DisposalRecord_categoryId_fkey
        FOREIGN KEY (categoryId)
        REFERENCES WasteCategory(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT DisposalRecord_collectionId_fkey
        FOREIGN KEY (collectionId)
        REFERENCES Collection(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT DisposalRecord_weightKg_check
        CHECK (weightKg > 0),

    CONSTRAINT DisposalRecord_pointsEarned_check
        CHECK (pointsEarned >= 0)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


-- =========================================================
-- REVIEW
-- Avaliação feita por cidadão sobre um ponto de coleta
-- =========================================================

CREATE TABLE Review (
    id VARCHAR(191) NOT NULL,

    citizenId VARCHAR(191) NOT NULL,
    collectionPointId VARCHAR(191) NOT NULL,

    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,

    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,

    INDEX Review_citizenId_idx(citizenId),
    INDEX Review_collectionPointId_idx(collectionPointId),

    INDEX Review_collectionPointId_createdAt_idx(
        collectionPointId,
        createdAt
    ),

    PRIMARY KEY (id),

    CONSTRAINT Review_citizenId_fkey
        FOREIGN KEY (citizenId)
        REFERENCES User(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT Review_collectionPointId_fkey
        FOREIGN KEY (collectionPointId)
        REFERENCES CollectionPoint(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT Review_rating_check
        CHECK (rating BETWEEN 1 AND 5)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;