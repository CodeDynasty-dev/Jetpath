-- Up migration
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
-- DROP TABLE file;