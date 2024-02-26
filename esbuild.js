import pkg from "./package.json" assert { type: "json" };
import esbuild from "esbuild";
import fs from "fs";
import path, { dirname } from "path";
import { sassPlugin } from "esbuild-sass-plugin";
import { dev } from "local-dev-server";

const [mode] = process.argv.splice(2);

const config = {
  entryRoots: fs
    .readdirSync(".")
    .filter(
      (file) =>
        fs.statSync(file).isDirectory() &&
        !["node_modules", "dist"].includes(file)
    ),
  target: "dist",
  copyFolders: ["assets", "images", "workers"],
  entryPoints: ["index.js", "index.ts", "index.jsx", "index.tsx"],
};

console.log(config);

//esbuild 如果所有入口都是一个根目录会提升一级目录 ！！！
const outRoot = config.entryRoots.length == 1 ? config.entryRoots.at(0) : "";

function findEntryPoints(dirPath) {
  const dirStat = fs.statSync(dirPath);
  if (dirStat.isDirectory()) {
    //check src
    if (dirPath.endsWith("src")) {
      for (let entryPoint of config.entryPoints) {
        const entryPointPath = path.join(dirPath, entryPoint);
        if (fs.existsSync(entryPointPath)) {
          return [entryPointPath];
        }
      }
    } else {
      const entryPoints = [];
      fs.readdirSync(dirPath).forEach((file) => {
        const filePath = path.join(dirPath, file);
        entryPoints.push(...findEntryPoints(filePath));
      });
      return entryPoints;
    }
  }
  return [];
}
const entryPoints = [];
//find all entry points
config.entryRoots.forEach((dir) => {
  entryPoints.push(...findEntryPoints(dir));
});

console.log("EntryPoints", entryPoints);

//define global externals
const externalRules = [];
const externalDefines = {};
for (let [key, rule] of Object.entries(pkg.externals ?? {})) {
  const path =
    typeof rule === "string" ? rule : rule[mode == "all" ? "prod" : mode];

  externalDefines[
    key
      .replace(/^\^/, "")
      .replace(/^~\//, "")
      .replace(/\$$/, "")
      .replaceAll(/-/g, "_")
      .replaceAll(/\//g, "_")
      .toUpperCase() + "_PATH"
  ] = `"${path}"`;

  externalRules.push({
    filter: new RegExp(key),
    path,
  });
}

console.log("GLOBAL Defines:", externalDefines);

const externalPlugin = {
  name: "external",
  setup(build) {
    for (let rule of externalRules) {
      build.onResolve({ filter: rule.filter }, (args) => {
        console.log(
          "find rule",
          rule,
          args.path.replace(rule.filter, rule.path)
        );
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
  outdir: path.join(config.target, entryPoints.length == 1 ? "" : outRoot),
  plugins: [
    externalPlugin,
    sassPlugin({
      type: "css-text",
    }),
  ],
};
//create http server
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
  const copyTo = (from, subEntries, target, recursive = false) => {
    subEntries.forEach((copyFolder) => {
      const resourceDir = path.join(from, `./${copyFolder}`);
      if (fs.existsSync(resourceDir)) {
        const dirStat = fs.statSync(resourceDir);
        fs.cpSync(resourceDir, path.join(target, resourceDir), {
          recursive: dirStat.isDirectory(),
        });
      }
    });
    if (recursive) {
      fs.readdirSync(from)
        .filter((item) => {
          return (
            fs.statSync(path.join(from, item)).isDirectory() &&
            !subEntries.includes(item)
          );
        })
        .forEach((sub) => {
          copyTo(path.join(from, sub), [...subEntries], target, true);
        });
    }
  };

  copyTo(".", [...config.copyFolders, "index.html"], config.target);

  config.entryRoots.forEach((entryRoot) => {
    copyTo(
      entryRoot,
      [...config.copyFolders, "index.html"],
      config.target,
      true
    );
  });

  await esbuild.build(options);

  console.log(`build  ok!`);

  if (mode == "all") {
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
