import esbuild from "esbuild";
import process from "process";

const watch = process.argv.includes("--watch");
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  sourcemap: "inline",
  treeShaking: true,
  outfile: "main.js",
  logLevel: "info"
});

if (watch) await context.watch();
else { await context.rebuild(); await context.dispose(); }
