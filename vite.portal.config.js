import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const portalEntry = fileURLToPath(
  new URL("./src/js/portal.js", import.meta.url),
);

export default defineConfig({
  base: "./",

  build: {
    outDir: "dist-portal",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2018",

    lib: {
      entry: portalEntry,
      name: "TadawulApplication",
      formats: ["iife"],
      fileName: () => "assets/js/main.js",
      cssFileName: "main",
    },

    rollupOptions: {
      output: {
        inlineDynamicImports: true,

        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || "";

          if (/\.css$/i.test(name)) {
            return "assets/css/main.css";
          }

          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return "assets/images/[name].[ext]";
          }

          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) {
            return "assets/fonts/[name].[ext]";
          }

          return "assets/[name].[ext]";
        },
      },
    },
  },

  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === "css" && filename.startsWith("assets/")) {
        return `../${filename.slice("assets/".length)}`;
      }

      return filename;
    },
  },
});
