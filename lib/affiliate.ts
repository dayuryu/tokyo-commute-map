// 住居検索ポータルへのリンク生成 facade。
//
// **現状（2026-06-10）: アフィリエイト未契約 — 全リンクは無報酬の素リンク。**
// 短期方針は SEO / 流量優先で広告接続は保留（ユーザー決定）。これに伴い
// StationDrawer の「PR」表記・rel="sponsored" は撤去済み。**ASP 契約を結んで
// a8mat_* 環境変数を設定する際は、docs/affiliate-compliance.md §3-1 に従い
// PR 表記と rel="sponsored" を必ず復元すること**（ステマ規制）。
//
// 設計方針：
// - 3 社とも駅単位 deep link：
//   - SUUMO: scripts/build_suumo_station_map.py が生成する suumo_stations.json の
//     駅 ID マップに依存。未ロード時 / 駅名未ヒット時は賃貸トップへ fallback。
//   - HOME'S: 物件一覧の freeword GET パラメータ（2026-06-10 実地検証:
//     cond[freeword]=高田馬場 で全 160 万件 → 駅周辺 6,283 件に絞られることを確認）。
//   - CHINTAI: /direct/?dir_word=<駅名>（駅・エリア選択ページに着地、
//     トップの検索フォームと同じ GET 経路）。
// - a8mat ID 未設定時はターゲット URL を直接返す fallback 動作。
//   ⇒ 環境変数を埋めるだけで affiliate 計測が ON になる（将来用に維持）。
// - process.env.NEXT_PUBLIC_* は Next.js 編集時に静的置換されるため、
//   動的 key アクセスは使えない。各広告主ごとにリテラル文字列で参照する。
//
// ⚠️ 収益化再開時の注意（2026-06-08 検証 / docs/affiliate-setup.md「現実チェック」参照）:
//   本 facade は「SUUMO / HOME'S / CHINTAI を A8 でラップ」する前提（a8mat_* 環境変数）で
//   組まれているが、公開情報の検証では **主要賃貸広告主（SUUMO / HOME'S / DOOR賃貸）は
//   A8 でなくバリューコマース経由が主**で、SUUMO 賃貸の A8 提携可否は非公開。
//   実際に ASP を接続する前に、各広告主が「どの ASP・どの link 形式・どの成果条件」かを
//   管理画面で確認し、wrapWithA8 / fallbackUrl の設計を見直すこと。

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
  // 駅 deep link を生成（解決できない場合 null）。SUUMO のみ駅 ID マップが必要。
  buildDeepLink?: (name: string, map?: SuumoStationMap) => string | null
  // 深い link が作れない / map が未ロードの時の fallback URL
  fallbackUrl: string
}

// 駅名 normalize：全角・半角スペース除去 + 末尾「駅」除去 + 消歧括弧除去。
// geojson の駅名には同名衝突回避の括弧後缀（田町(東京) / 浦安(千葉) 等）が
// 付くことがあり、そのままではポータル検索にヒットしない。
function normalizeStationName(name: string): string {
  return name
    .replace(/[ 　]/g, '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/駅$/, '')
    .trim()
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
      if (!map) return null
      const entry = findSuumoEntry(name, map)
      if (!entry) return null
      return `https://suumo.jp/chintai/${entry.pref}/ek_${entry.ek_id}/?rn=${entry.rn}`
    },
  },
  homes: {
    label: "LIFULL HOME'S",
    fallbackUrl: 'https://www.homes.co.jp/chintai/',
    // 物件一覧の freeword GET（fwtype=2 はトップ検索フォームの hidden 値に追従）。
    // 2026-06-10 実地検証：駅名 freeword で駅周辺物件に絞られることを確認。
    buildDeepLink: (name) => {
      const n = normalizeStationName(name)
      if (!n) return null
      return `https://www.homes.co.jp/chintai/list/?cond%5Bfreeword%5D=${encodeURIComponent(n)}&cond%5Bfwtype%5D=2`
    },
  },
  chintai: {
    label: 'CHINTAI',
    fallbackUrl: 'https://www.chintai.net/chintai/',
    // トップの駅・エリア検索フォームと同じ GET 経路（駅・エリア選択ページに着地）
    buildDeepLink: (name) => {
      const n = normalizeStationName(name)
      if (!n) return null
      return `https://www.chintai.net/direct/?dir_word=${encodeURIComponent(n)}`
    },
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
 * 駅名から該当ポータルの駅検索 URL を生成する（a8mat 設定時のみ A8 ラップ）。
 *
 * SUUMO: suumoMap の駅エントリが見つかれば駅 deep link、それ以外は賃貸トップ。
 * HOME'S / CHINTAI: 駅名ベースの検索 GET（マップ不要、全駅対応）。
 */
export function buildAffiliateLink(
  stationName: string,
  program: AffiliateProgram,
  suumoMap?: SuumoStationMap
): string {
  const meta = PROGRAMS[program]
  const target = meta.buildDeepLink?.(stationName, suumoMap) ?? meta.fallbackUrl
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
