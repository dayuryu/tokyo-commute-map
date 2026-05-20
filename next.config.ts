import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // dev-only floating indicator を左下に逃がす（Legend は右下、
  // HeaderMenu は右上にあるため、左下は空いている）。
  // prod ビルドには影響しない。
  devIndicators: {
    position: 'bottom-left',
  },
};

export default withNextIntl(nextConfig);
