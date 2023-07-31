import pkg from "./package.json" assert { type: "json" };
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { sassPlugin } from "esbuild-sass-plugin";
import { dev } from "local-dev-server";

// process.on("exit", () => {
//   console.log("exit");
// });

const entryRoots = ["./modules"];
const target = "./dist";
//把这些资源目录一同拷贝
const copyFolders = ["assets", "images"];

const [mode] = process.argv.splice(2);
//esbuild 如果所有入口都是一个根目录会提升一级目录 ！！！
const outRoot = entryRoots.length == 1 ? entryRoots.at(0) : "";
//console.log(outRoot, "outRoot")
const entryPoints = [];
const findEntryPoints = (dirPath) => {
  const dirStat = fs.statSync(dirPath);
  if (dirStat.isDirectory()) {
    //check src
    if (dirPath.endsWith("src")) {
      const jsxIndex = path.join(dirPath, "index.jsx");
      if (fs.existsSync(jsxIndex)) {
        entryPoints.push(jsxIndex);
        return;
      }

      const tsxIndex = path.join(dirPath, "index.tsx");
      if (fs.existsSync(tsxIndex)) {
        entryPoints.push(tsxIndex);
        return;
      }
      const jsIndex = path.join(dirPath, "index.js");
      if (fs.existsSync(jsIndex)) {
        entryPoints.push(jsIndex);
        return;
      }
      const tsIndex = path.join(dirPath, "index.ts");
      if (fs.existsSync(tsIndex)) {
        entryPoints.push(tsIndex);
        return;
      }
    } else {
      fs.readdirSync(dirPath).forEach((file) => {
        const filePath = path.join(dirPath, file);
        findEntryPoints(filePath);
      });
    }
  }
};
entryRoots.forEach((dir) => {
  findEntryPoints(dir);
});

console.log("EntryPoints", entryPoints);
const externalRules = [];
const externalDefines = {};
for (let [key, rule] of Object.entries(pkg.externals ?? {})) {
  const path =
    typeof rule === "string" ? rule : rule[mode == "all" ? "prod" : mode];

  externalDefines[key.replaceAll(/[\^\$-/]/g,(s)=>{
    if(s=="-"|| s=="/"){
      return "_"
    }
    return "";
  }).toUpperCase()+"_PATH"] = `"${path}"` ;

  externalRules.push({
    filter: new RegExp(key),
    path,
  });
}

console.log("GLOBAL Defines:",externalDefines)

const externalPlugin = {
  name: "external",
  setup(build) {
    for (let rule of externalRules) {
      build.onResolve({ filter: rule.filter }, (args) => {
        // console.log(
        //   "find rule",
        //   rule,
        //   args.path.replace(rule.filter, rule.path)
        // );
        return {
          path: args.path.replace(rule.filter, rule.path),
          external: true,
        };
      });
    }
  },
};

const options = {
  jsxFactory: "h",
  jsxFragment: "h.f",
  format: "esm",
  bundle: true,
  define: externalDefines,
  sourcemap: mode == "dev",
  drop: mode !== "dev" ? ["console"] : [], //发布后取消console输出
  dropLabels: mode !== "dev" ? ["DEV", "TEST"] : [], //发布去除这些标签代码
  minify: true,
  charset: "utf8",
  entryPoints,
  entryNames:
    entryPoints.length == 1
      ? `${path.join(entryPoints.at(0), "../../")}/[name]`
      : "[dir]/../[name]", //src的上层目录
  outdir: path.join(target, entryPoints.length == 1 ? "" : outRoot),
  plugins: [
    externalPlugin,
    sassPlugin({
      type: "css-text",
    }),
  ],
};

if (mode == "dev") {
  let buildResult = null;
  const response = (filePath, res) => {
    const outfile = buildResult?.outputFiles.find(
      (file) => file.path == filePath
    );
    if (outfile) {
      res.setHeader("Content-Type", "application/javascript;charset=utf-8");
      res.end(outfile.contents);
      return true;
    }
    return false;
  };
  const { reload } = dev(
    { ...pkg.localDev.server, response },
    pkg.localDev.apis
  );
  const ctx = await esbuild.context({
    ...options,
    write: false,
    outdir: entryPoints.length == 1 ? "./" : `./${outRoot}`,
    plugins: [
      {
        name: "watch-plugin",
        setup(build) {
          build.onStart(() => {
            console.log(
              "starting build.............................................."
            );
          });
          build.onEnd((result) => {
            if (result.errors.length == 0) {
              buildResult = result;
              reload("[app rebuild ok]");
            } else {
              console.log("build error", result.errors);
            }
          });
        },
      },
      externalPlugin,
      sassPlugin({
        type: "css-text",
      }),
    ],
  });
  await ctx.watch();
  console.log("watching.........................................");
} else if (mode == "prod" || mode == "all") {
  //拷贝所有资源目录
  entryPoints.forEach((entryPoint) => {
    copyFolders.forEach((copyFolder) => {
      const resourceDir = path.join(entryPoint, `../../${copyFolder}`);
      if (fs.existsSync(resourceDir)) {
        const dirStat = fs.statSync(resourceDir);
        if (dirStat.isDirectory()) {
          fs.cpSync(resourceDir, path.join(target, resourceDir), {
            recursive: true,
          });
        }
      }
    });
  });

  await esbuild.build(options);

  console.log(`build  ok!`);

  if (mode == "all") {
    fs.cpSync("index.html", path.join(target, "index.html"));
    // fs.cpSync("es-lib", path.join(target, "es-lib"), { recursive: true });

    for (let [key, rule] of Object.entries(pkg.externals ?? {})) {
      if (typeof rule !== "string" && rule.dev !== rule.prod) {
        const devDir = path.join(".", path.dirname(rule.dev));
        const prodDir = path.join(target, path.dirname(rule.prod));
        console.log(`begin copy from "${devDir}" to "${prodDir}"`);
        fs.cpSync(devDir, prodDir, { recursive: true });
        console.log(`end copy from "${devDir}" to "${prodDir}"`);
      }
    }
  }
}
