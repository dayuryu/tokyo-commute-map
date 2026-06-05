/**
 * データ加載層の atom。各データソースは初回 fetch 後は読み取り専用。
 *
 * 加載ロジックは hooks/useDataLoaders.ts が担当し、ここでは「空コンテナ初値の器」
 * のみ定義する。ADR-0003 の方針により async/loadable atom は採らず、
 * primitive atom + useEffect→setAtom で現状と byte-for-byte 等価を保つ。
 * 初値はすべて旧 page.tsx の useState 初期値を踏襲。
 */
import { atom } from 'jotai'
import type { CustomStation, Station, ConsensusMap } from '@/lib/types'
import type { SuumoStationMap } from '@/lib/affiliate'
import type { RentMap } from '@/lib/manual-rent'
import type { GovernmentRentMap } from '@/lib/government-rent'
import type { LineStyleMap } from '@/lib/line-styles'
import type { EntranceMap } from '@/lib/station-entrances'
import type { PreparedGraph } from '@/lib/dijkstra'

/** 1843 駅の {code,name,lat,lon}。DestinationPicker / AiWizard / DestinationAsk の検索源。 */
export const stationListAtom = atom<CustomStation[]>([])

/** 駅名 → Station の lookup。AI highlight / wizard resolve で駅名から駅情報を引く。 */
export const stationByNameAtom = atom<Record<string, Station>>({})

/** 駅 code × destination → 通勤時間合意値（≥3 票 trimmed median）。StationDrawer 表示。 */
export const consensusAtom = atom<ConsensusMap>({})

/** SUUMO 駅 deep link マップ。404 時 null → StationDrawer が SUUMO トップへ fallback。 */
export const suumoMapAtom = atom<SuumoStationMap | null>(null)

/** 手動収録家賃（101 駅）。StationDrawer の家賃表示。 */
export const rentMapAtom = atom<RentMap>({})

/** 政府住宅統計家賃（1940 駅 baseline）。SUUMO 未収録駅の fallback。 */
export const governmentRentAtom = atom<GovernmentRentMap>({})

/** 路線スタイル（color/symbol）。StationDrawer の主要路線色条。 */
export const lineStylesAtom = atom<LineStyleMap>({})

/** 路線名 → 英語名（154 路線）。en locale の StationDrawer 主要路線表示。
 *  404 時は空のまま → 日本語名 fallback。 */
export const lineNamesEnAtom = atom<Record<string, string>>({})

/** OSM 由来の駅出入口座標（~77% カバレッジ）。StationDrawer の Street View link。 */
export const stationEntrancesAtom = atom<EntranceMap>({})

/** クライアント Dijkstra 用 adjacency graph。失敗時 null（haversine fallback）。
 *  AiWizard の custom destination 通勤算出 / customCommutes 派生で使う。 */
export const graphAtom = atom<PreparedGraph | null>(null)
