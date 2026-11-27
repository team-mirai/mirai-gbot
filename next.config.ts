import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // kuromoji は辞書ファイルを実行時に fs から読むため、バンドルせずそのまま使う
  serverExternalPackages: ["kuromoji"],
  // Vercel などのデプロイ先に辞書ファイルを同梱する
  outputFileTracingIncludes: {
    "/api/furigana": ["./node_modules/kuromoji/dict/**/*"],
  },
};

export default nextConfig;
