-- Up migration

CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
     username TEXT UNIQUE,
     password TEXT,
     email TEXT UNIQUE,
     role TEXT,
     isAdmin INTEGER,
     createdAt INTEGER,
     banned INTEGER
);

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
-- DROP TABLE user;
-- DROP TABLE voucher;
-- DROP TABLE file;