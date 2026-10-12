import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  ...[
    {
      layer: "shared",
      disallow: ["entities", "features", "widgets", "_pages"],
    },
    { layer: "entities", disallow: ["features", "widgets", "_pages"] },
    { layer: "features", disallow: ["widgets", "_pages"] },
    { layer: "widgets", disallow: ["_pages"] },
  ].map(({ layer, disallow }) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: disallow.map((name) => ({
            group: [`@/${name}`, `@/${name}/**`],
            message:
              "상위 계층의 코드를 하위 계층에서 참조하지 않습니다. docs/development/conventions.md 확인.",
          })),
        },
      ],
    },
  })),
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "src/shared/api/generated-api.ts",
  ]),
]);
