import { Schema, SqliteBruv } from "sqlitebruv";

export const user = new Schema<{
  id: string;
  username: string;
  password: string;
  email: string;
  role: string;
  isAdmin: boolean;
  createdAt: number;
  banned: boolean;
}>({
  name: "user",
  columns: {
    username: { type: "TEXT", unique: true },
    password: { type: "TEXT" },
    email: { type: "TEXT", unique: true },
    role: { type: "TEXT" },
    isAdmin: { type: "INTEGER" },
    createdAt: { type: "INTEGER" },
    banned: { type: "INTEGER" },
  },
});

export const voucher = new Schema<{
  code: string;
  amount: number;
  createdAt: number;
  isUsed: boolean;
  expiresAt: number;
  createdBy: string;
}>({
  name: "voucher",
  columns: {
    code: { type: "TEXT", unique: true },
    amount: { type: "INTEGER" },
    isUsed: { type: "INTEGER" },
    expiresAt: { type: "INTEGER" },
    createdBy: { type: "TEXT" },
    createdAt: { type: "INTEGER" },
  },
});

export const file = new Schema<{
  name: string;
  path: string;
  size: number;
  createdAt: number;
  userId: string;
  mimeType: string;
}>({
  name: "file",
  columns: {
    name: { type: "TEXT", unique: true },
    path: { type: "TEXT" },
    size: { type: "INTEGER" },
    createdAt: { type: "INTEGER" },
    userId: { type: "TEXT" },
    mimeType: { type: "TEXT" },
  },
});

export const db = new SqliteBruv({
  localFile: "db.db",
  logging: true,
  schema: [user, voucher, file],
});
