/**
 * iOS PWA 起動スプラッシュ画像（apple-touch-startup-image）の SSOT。
 *
 * iOS は manifest の background_color / icons からスプラッシュを生成しない。
 * `<link rel="apple-touch-startup-image" media="...">` をデバイス解像度ごとに
 * 用意しないと、ホーム画面起動時に白画面が出る。ここで定義した一覧を
 * `app/[locale]/layout.tsx` の `appleWebApp.startupImage` が消費する。
 *
 * 画像の実体は `scripts/generate_pwa_assets.mjs` が public/splash/ に生成する。
 * デバイス数値（w/h/dpr）は必ずあちらの SPLASH_DEVICES と一致させること。
 */

export type SplashDevice = {
  /** 論理幅 (CSS px, portrait) */
  w: number
  /** 論理高さ (CSS px, portrait) */
  h: number
  /** device pixel ratio */
  dpr: number
}

// generate_pwa_assets.mjs の SPLASH_DEVICES と同一順・同一数値
export const SPLASH_DEVICES: SplashDevice[] = [
  // iPhone
  { w: 375, h: 667, dpr: 2 }, // SE2/SE3, 6/7/8
  { w: 414, h: 736, dpr: 3 }, // 6+/7+/8+
  { w: 375, h: 812, dpr: 3 }, // X/XS/11Pro/12mini/13mini
  { w: 414, h: 896, dpr: 2 }, // XR/11
  { w: 414, h: 896, dpr: 3 }, // XSMax/11ProMax
  { w: 390, h: 844, dpr: 3 }, // 12/13/14
  { w: 428, h: 926, dpr: 3 }, // 12/13ProMax, 14Plus
  { w: 393, h: 852, dpr: 3 }, // 14Pro/15/15Pro/16
  { w: 430, h: 932, dpr: 3 }, // 14ProMax/15Plus/15ProMax/16Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  // iPad
  { w: 768, h: 1024, dpr: 2 }, // mini/9.7
  { w: 810, h: 1080, dpr: 2 }, // 10.2
  { w: 834, h: 1112, dpr: 2 }, // 10.5/Air
  { w: 820, h: 1180, dpr: 2 }, // 10.9 Air/iPad10
  { w: 834, h: 1194, dpr: 2 }, // 11" Pro
  { w: 1024, h: 1366, dpr: 2 }, // 12.9" Pro
  { w: 744, h: 1133, dpr: 2 }, // mini 6
]

const splashUrl = (d: SplashDevice) =>
  `/splash/apple-splash-${d.w * d.dpr}-${d.h * d.dpr}.png`

// portrait 固定。ホーム画面からの起動は実質ポートレートのため、landscape は
// 意図的に省略（画像点数を抑える）。
const splashMedia = (d: SplashDevice) =>
  `screen and (device-width: ${d.w}px) and (device-height: ${d.h}px) ` +
  `and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`

/** Next.js Metadata の appleWebApp.startupImage 形式に変換 */
export function appleStartupImages(): { url: string; media: string }[] {
  return SPLASH_DEVICES.map(d => ({ url: splashUrl(d), media: splashMedia(d) }))
}
