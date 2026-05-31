/**
 * 駅周辺エリア AI 要約の atom。locale 依存（ja / zh）。
 *
 * data.ts と別ファイルにしているのは、加載が next-intl の locale に依存し
 * （useDataLoaders 内の [locale] 依存 effect で再 fetch）、他のデータソースと
 * ライフサイクルが異なるため。未取得 locale は ja にフォールバック。
 */
import { atom } from 'jotai'
import type { AreaFeatureMap } from '@/lib/area-features'

/** 駅名 → 周辺特徴文字列。1843 駅。StationDrawer の「周辺の特徴」。未取得時は空 dict。 */
export const areaFeaturesAtom = atom<AreaFeatureMap>({})
