import { readFile, writeFile } from "node:fs/promises";
console.log("JetPath: compiling...");
const html = await readFile("src/primitives/api-doc.html", {
  encoding: "utf-8",
}); 

const res = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  packages: 'external', 
  // minify: true,
});

if (!res.success) {
  console.log(...res.logs);
} else {  
  const build = Bun.spawn(["./pack"]);
  await build.exited;
  const code = await readFile("dist/index.js", {
    encoding: "utf-8",
  });
  await writeFile("dist/index.js", code.replace("{{view}}", html));
}
//
// const build = Bun.spawn(["./pack"]);
// await build.exited;
console.log("JetPath: compiled!");
