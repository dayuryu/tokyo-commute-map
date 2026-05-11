import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 関東左下隅の N アイコン（dev-only floating indicator）が
  // HelpButton と重なるため位置を bottom-right に逃がす。
  // prod ビルドには影響しない。
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
