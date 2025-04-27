// Don't rename this file or the directory
// import your db class correctly below and run the file to apply.
import { db } from "../src/db/index.ts";
import { readFileSync } from "node:fs";

const filePath = "Bruv-migrations/Sun_Apr_27_2025_19:09:48.sql";
const migrationQuery = readFileSync(filePath, "utf8");
const info = await db.raw(migrationQuery);
console.log(info);
// bun Bruv-migrations/migrate.ts 
      