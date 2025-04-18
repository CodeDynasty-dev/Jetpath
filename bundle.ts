import { readFile, writeFile } from "fs/promises";

console.log("Jetpath: compiling...");
const html = await readFile("src/primitives/api-doc.html", {
  encoding: "utf-8",
});
const code = await readFile("dist/index.js", {
  encoding: "utf-8",
}); 

await writeFile("dist/index.js", code.replace("{{view}}", html));
console.log("Jetpath: compiled!");

// [X] npm pack will call npm run prepare which will run this file




