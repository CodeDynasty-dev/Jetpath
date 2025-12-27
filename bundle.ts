import { readFile, writeFile } from "fs/promises";
// ? This file does a lot of in just few lines thanks to bunjs
console.log("Jetpath: compiling...");
const html = await readFile("src/assets/api-doc.html", {
  encoding: "utf-8",
}); 
await Bun.build({
  entrypoints: ["src/assets/bundle.ts"],
  outdir: "src/assets",
  // minify: true,
});
const html_script_code = await readFile("src/assets/bundle.js", {
  encoding: "utf-8",
});
const view = html.replace(
  "{JETPATH-DOC-SCRIPT}",
  html_script_code,
) 
await writeFile("dist/jetpath-doc.html", view);
console.log("Jetpath: compiled!");

// [X] npm pack will call npm run prepare which will run this file
