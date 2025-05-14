import { readFile, writeFile } from "fs/promises";

console.log("Jetpath: compiling...");
const html = await readFile("src/assets/api-doc.html", {
  encoding: "utf-8",
});
const code = await readFile("dist/index.js", {
  encoding: "utf-8",
});
await Bun.build({
  entrypoints: ["src/assets/bundle.ts"],
  outdir: "src/assets",
  minify: true,
  // additional config
});
const html_script_code = await readFile("src/assets/bundle.js", {
  encoding: "utf-8",
});
const view = html.replaceAll(/(\n|\r|\s{2,})/g, "").replace(
  "{JETPATH-DOC-SCRIPT}",
  html_script_code,
).replaceAll(/`/g, "\\`")
  .replaceAll(/\${/g, "\\${");
await writeFile("dist/index.js", code.replace("{{view}}", view));
console.log("Jetpath: compiled!");

// [X] npm pack will call npm run prepare which will run this file
