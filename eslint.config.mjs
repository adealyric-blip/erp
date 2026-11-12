import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react-hooks/set-state-in-effect": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // Plan rule (T01, adapted add-only): the service-role client is
  // server-only. Legacy client @/lib/supabaseAdmin is used by the API
  // routes today; plan client @/server/supabase/admin is new (T04).
  // Neither may be imported from a client component or page — the
  // negative test (a temp component importing the admin client) must
  // fail lint. API routes under src/app/api/** are unaffected.
  files: ["src/components/**/*.{ts,tsx}", "src/app/**/page.{ts,tsx}", "src/app/(auth)/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "@/lib/supabaseAdmin", message: "Service-role client is server-only: use it only from Route Handlers / src/server/* — never from a component or page." },
        { name: "@/lib/supabaseConfig", message: "The Supabase service-role key lives here: server-only, never from a component or page." },
        { name: "@/server/supabase/admin", message: "Service-role client is server-only: import it only from src/server/supabase/admin.ts and the allow-listed server routes (plan/04)." },
      ],
    }],
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "scripts/ingest-*.js"]
}];

export default eslintConfig;
