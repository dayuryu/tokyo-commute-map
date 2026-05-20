/**
 * 跨ファイル共有 type の SSOT。
 *
 * **追加時のルール**:
 * - component や page から export して他 component に import される type は必ずここに移す
 * - page.tsx は 700+ 行の orchestrator なので、そこを「type の住所」にすると import 経路が
 *   循環依存 / 移動コスト爆発の温床になる
 *
 * **このファイルの境界**:
 * - 純粋な data shape のみ。React や JSX を import しない。
 * - 業務 enum / 定数は `lib/constants.ts` か `lib/destinations.ts` 等の専用層へ。
 * - external API の response 型は `lib/api/<service>/schemas.ts` に持つ (zod 校验込み)。
 */

import type { FixedDestination } from '@/lib/destinations'
import type { CommuteResult } from '@/lib/dijkstra'

// 既存業務型を ergonomic な 1-stop import 経路として re-export する。
// component 側は `import type { Destination, Station, CustomStation } from '@/lib/types'`
// と書けば全部揃う。元定義は `@/lib/destinations` に保つ (DESTINATIONS_META 等の業務
// データと一緒に同居するのが自然なため)。
export type { Destination, FixedDestination } from '@/lib/destinations'

/** AI Wizard の結果カードクリックで drawer を開く時に渡す station 形式。
 *  stations.geojson の properties 全部 + lat/lon を 1 オブジェクト化したもの。 */
export interface CustomStation {
  code: number
  name: string
  lat: number
  lon: number
}

/** 30 fixed destination ごとに自動生成される通勤時間フィールド。
 *  build_stations_geojson_v3.py がこれらを stations.geojson の properties に書き出す。
 *  custom destination は client 側 Dijkstra で別途算出されるため optional。 */
export type CommuteFields = {
  [K in FixedDestination as `min_to_${K}`]?: number
} & {
  [K in FixedDestination as `transfers_to_${K}`]?: number
} & {
  [K in FixedDestination as `bucket_${K}`]?: number
} & {
  min_to_custom?: number
  transfers_to_custom?: number
}

/** 駅 1 件の全 properties。Map の地物 / Drawer の表示 / Wizard 結果クリック等で
 *  共通入力となる schema。stations.geojson の各 feature properties に対応。 */
export interface Station extends CommuteFields {
  code: number
  name: string
  lat: number
  lon: number
  /** shinjuku ベースのデフォルト bucket（5 分刻みの分類値） */
  bucket: number
  /** 所属路線名。build_stations_geojson_v3.py が station_database から注入 */
  line_names?: string[]
}

/** custom destination 用、駅 code → 通勤情報の Map。
 *  MapView と StationDrawer の共通入力。null は「未算出 / haversine fallback」を示す。 */
export type CustomCommutesMap = Map<number, CommuteResult> | null

/** 評価ビュー (station_time_consensus) から取得する 1 件分の通勤時間合意値。
 *  ≥3 票の trimmed median とその票数。 */
export type ConsensusEntry = { min: number; count: number }

/** 駅 code × fixed destination → ConsensusEntry の二次元 map。
 *  StationDrawer が「みんなの通勤時間」を表示するのに使う。 */
export type ConsensusMap = Record<
  number,
  Partial<Record<FixedDestination, ConsensusEntry>>
>
