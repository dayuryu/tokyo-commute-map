// アフィリエイト広告のリンク生成 facade。
//
// 設計方針：
// - SUUMO は駅単位 deep link（scripts/build_suumo_station_map.py が生成する
//   suumo_stations.json に依存）。マップ未ロード時 / 駅名未ヒット時は SUUMO 賃貸
//   トップにフォールバック。
// - HOME'S / CHINTAI は現状トップページへの fallback のみ（V2 で deep link 化予定）。
// - a8mat ID 未設定時はターゲット URL を直接返す fallback 動作。
//   ⇒ 環境変数を埋めるだけで affiliate 計測が ON になる。
// - process.env.NEXT_PUBLIC_* は Next.js 編集時に静的置換されるため、
//   動的 key アクセスは使えない。各広告主ごとにリテラル文字列で参照する。

export type AffiliateProgram = 'suumo' | 'homes' | 'chintai'

export const ALL_PROGRAMS: AffiliateProgram[] = ['suumo', 'homes', 'chintai']

// SUUMO 駅マップ — scripts/build_suumo_station_map.py の出力 JSON エントリ
export interface SuumoStationEntry {
  name:    string  // 「駅」サフィックス除去済み
  ek_id:   string
  rn:      string
  pref:    string
  name_raw?: string
  sample_url?: string
}

// 駅名 → entry のルックアップマップ（page.tsx で JSON を読み込んで構築）
export type SuumoStationMap = Record<string, SuumoStationEntry>

interface ProgramMeta {
  label: string
  // 駅 deep link を生成（解決できない場合 null）。SUUMO だけが実装。
  buildDeepLink?: (name: string, map: SuumoStationMap) => string | null
  // 深い link が作れない / map が未ロードの時の fallback URL
  fallbackUrl: string
}

// 駅名 normalize：全角・半角スペース除去 + 末尾「駅」除去
function normalizeStationName(name: string): string {
  return name.replace(/[ 　]/g, '').replace(/駅$/, '').trim()
}

// SUUMO map から駅 entry を探す。ヶ⇔ケ・ヵ⇔カ の表記ゆれを吸収。
function findSuumoEntry(name: string, map: SuumoStationMap): SuumoStationEntry | null {
  const n = normalizeStationName(name)
  const candidates = [
    n,
    n.replace(/ヶ/g, 'ケ'),
    n.replace(/ケ/g, 'ヶ'),
    n.replace(/ヵ/g, 'カ'),
    n.replace(/カ/g, 'ヵ'),
  ]
  for (const k of candidates) {
    if (map[k]) return map[k]
  }
  return null
}

const PROGRAMS: Record<AffiliateProgram, ProgramMeta> = {
  suumo: {
    label: 'SUUMO 賃貸',
    fallbackUrl: 'https://suumo.jp/chintai/',
    buildDeepLink: (name, map) => {
      const entry = findSuumoEntry(name, map)
      if (!entry) return null
      return `https://suumo.jp/chintai/${entry.pref}/ek_${entry.ek_id}/?rn=${entry.rn}`
    },
  },
  homes: {
    label: "LIFULL HOME'S",
    fallbackUrl: 'https://www.homes.co.jp/chintai/',
    // HOME'S 駅 deep link は未対応（V2 で反向工程予定）
  },
  chintai: {
    label: 'CHINTAI',
    fallbackUrl: 'https://www.chintai.net/chintai/',
    // CHINTAI 駅 deep link は未対応（V2 で反向工程予定）
  },
}

// Next.js は NEXT_PUBLIC_* をビルド時にリテラル参照のみ静的置換するため switch で記述。
function readA8Mat(program: AffiliateProgram): string | undefined {
  switch (program) {
    case 'suumo':   return process.env.NEXT_PUBLIC_A8_MAT_SUUMO
    case 'homes':   return process.env.NEXT_PUBLIC_A8_MAT_HOMES
    case 'chintai': return process.env.NEXT_PUBLIC_A8_MAT_CHINTAI
  }
}

/**
 * A8.net のリダイレクト URL でターゲット URL をラップする。
 * 環境変数 NEXT_PUBLIC_A8_MAT_<PROGRAM> が未設定の場合はターゲット URL をそのまま返す。
 */
export function wrapWithA8(targetUrl: string, program: AffiliateProgram): string {
  const a8mat = readA8Mat(program)
  if (!a8mat) return targetUrl
  return `https://px.a8.net/svt/ejp?a8mat=${a8mat}&a8ejpredirect=${encodeURIComponent(targetUrl)}`
}

/**
 * 駅名から該当広告主の検索 URL を生成し、A8 でラップする。
 *
 * SUUMO: suumoMap が渡され駅エントリが見つかれば駅 deep link を使い、
 *        それ以外は SUUMO 賃貸トップにフォールバック。
 * HOME'S / CHINTAI: 現状は常にトップページへフォールバック（V2 で deep link 対応予定）。
 */
export function buildAffiliateLink(
  stationName: string,
  program: AffiliateProgram,
  suumoMap?: SuumoStationMap
): string {
  const meta = PROGRAMS[program]
  let target: string | null = null
  if (meta.buildDeepLink && suumoMap) {
    target = meta.buildDeepLink(stationName, suumoMap)
  }
  if (!target) target = meta.fallbackUrl
  return wrapWithA8(target, program)
}

export interface AffiliateProgramInfo {
  id: AffiliateProgram
  label: string
  /** 環境変数が設定済みかどうか。UI で「準備中」表示等の分岐に使用可能。 */
  isActive: boolean
}

export function getProgramInfo(program: AffiliateProgram): AffiliateProgramInfo {
  return {
    id: program,
    label: PROGRAMS[program].label,
    isActive: Boolean(readA8Mat(program)),
  }
}

export function getAllProgramInfo(): AffiliateProgramInfo[] {
  return ALL_PROGRAMS.map(getProgramInfo)
}
