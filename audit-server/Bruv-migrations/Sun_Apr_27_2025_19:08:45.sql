-- Up migration
CREATE TABLE voucher (
    id text PRIMARY KEY NOT NULL,
     code TEXT UNIQUE,
     amount INTEGER,
     isUsed INTEGER,
     expiresAt INTEGER,
     createdBy TEXT,
     createdAt INTEGER
);
CREATE TABLE file (
    id text PRIMARY KEY NOT NULL,
     name TEXT UNIQUE,
     path TEXT,
     size INTEGER,
     createdAt INTEGER,
     userId TEXT,
     mimeType TEXT
);

-- Down migration
-- DROP TABLE voucher;
-- DROP TABLE file;