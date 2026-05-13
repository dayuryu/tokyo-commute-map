'use client'

/**
 * AI 駅推薦 Wizard。
 *
 * 流れ:
 *   DestinationAsk で通勤先確定 + AI ボタン押下
 *     → Wizard mount、destination は props で固定
 *     → Q1..Q5 を「一問一屏」editorial スクロール感覚で進行
 *     → 5 問終了 → loading → /api/recommend POST → result（AiResultGrid）
 *     → カードクリック: onResolve(destination, station_name) で
 *                      ペアレントに最終駅名を通知、Wizard を閉じる
 *     → CTA: onClose() で Wizard 閉じ + 地図へ戻る
 *
 * destination は fixed slug 限定（custom destination は呼出側で blocking）。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  QUICK_DESTINATIONS,
  POPULAR_DESTINATIONS,
  getDestinationDisplayName,
  type FixedDestination,
} from '@/lib/destinations'
import type {
  Atmosphere,
  CommuteMaxMinutes,
  CustomDestinationInfo,
  CommuteByCode,
  Household,
  Recommendation,
  RecommendApiResponse,
  RentMax,
  SafetyPriority,
  WizardAnswers,
} from '@/lib/ai-recommend/types'
import { computeCommutes, type PreparedGraph } from '@/lib/dijkstra'
import type { CustomStation } from '@/app/page'
import AiResultGrid from './AiResultGrid'

const BG  = '#f3ecdd'
const INK = '#1c1812'
const RED = '#a8332b'
const DIM = '#7d7060'

// ── 駅名検索の正規化（Q1 autocomplete 用） ──────────────────────
// 日本の地名は「四ツ谷 ⇔ 四谷」「霞ヶ関 ⇔ 霞ケ関」「丸ノ内 ⇔ 丸の内」のような
// 表記揺れが多い。station_database はさらに「四ツ谷(四ッ谷)」のように主名 +
// 括弧別名の併記形式も含む。ユーザが「四谷」と入れて「四ツ谷」にヒットさせるため、
// 双方を軽量化（小カナ・の・が・括弧除去）して部分一致判定する。

/** 表記揺れの小カナと挿入助詞を除去した正規化文字列。 */
function normalizeForSearch(s: string): string {
  return s
    .replace(/[（(].*?[）)]/g, '')   // 括弧内別名を除去
    .replace(/[ツッヶケヵヮノ]/g, '') // 小カナ + 地名插入「ノ」（丸ノ内 ↔ 丸の内）
    .replace(/[がの]/g, '')          // 「の/が」挿入の地名表記揺れ
    .toLowerCase()
}

/** 駅名から検索キー候補（主名・括弧内別名・各々の正規化版）を抽出。 */
function buildSearchKeys(name: string): string[] {
  const keys: string[] = []
  const main = name.replace(/[（(].*?[）)]/g, '')
  const aliases = Array.from(name.matchAll(/[（(]([^）)]+)[）)]/g)).map(m => m[1])
  for (const candidate of [main, ...aliases]) {
    if (!candidate) continue
    keys.push(candidate)
    const norm = normalizeForSearch(candidate)
    if (norm && norm !== candidate) keys.push(norm)
  }
  return keys
}

// ── デバイス ID（StationDrawer と共通 key） ───────────────────────
function getDeviceId(): string {
  const key = 'tcm_device_id'
  let id = ''
  try {
    id = localStorage.getItem(key) ?? ''
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
  } catch {
    // Private browsing 等で localStorage 不可 → 一時 UUID（rate limit は IP で代用）
    id = crypto.randomUUID()
  }
  return id
}

// ── 質問定義 ─────────────────────────────────────────────────────
type AnswerValue = CommuteMaxMinutes | RentMax | Household | Atmosphere | SafetyPriority

type QuestionDef = {
  key:     keyof Omit<WizardAnswers, 'destination'>
  prelude: string  // italic Garamond
  title:   string  // 明朝大字
  options: { value: AnswerValue; label: string }[]
}

const QUESTIONS: QuestionDef[] = [
  {
    key:     'maxMinutes',
    prelude: 'how much time can you give?',
    title:   '通勤時間の上限は？',
    options: [
      { value: 30, label: '30 分以内' },
      { value: 45, label: '45 分以内' },
      { value: 60, label: '60 分以内' },
      { value: 90, label: '90 分以内' },
    ],
  },
  {
    key:     'rentMax',
    prelude: 'and your rent ceiling?',
    title:   '家賃の上限は？（月額）',
    options: [
      { value: '~7万',    label: '〜 7 万円' },
      { value: '7-10万',  label: '7 〜 10 万円' },
      { value: '10-15万', label: '10 〜 15 万円' },
      { value: '15万+',   label: '15 万円以上' },
    ],
  },
  {
    key:     'household',
    prelude: 'who are you living with?',
    title:   'ご家族構成は？',
    options: [
      { value: '単身',     label: '単身' },
      { value: 'カップル', label: 'カップル' },
      { value: '子持ち',   label: '子持ち' },
    ],
  },
  {
    key:     'atmosphere',
    prelude: 'what kind of street?',
    title:   '街の雰囲気は？',
    options: [
      { value: '賑やか',       label: '賑やか' },
      { value: '落ち着いた',   label: '落ち着いた' },
      { value: '緑が多い',     label: '緑が多い' },
      { value: '商業集中',     label: '商業集中' },
    ],
  },
  {
    key:     'safety',
    prelude: 'how much does safety matter?',
    title:   '治安はどれくらい重視？',
    options: [
      { value: '最重要',       label: '最重要' },
      { value: '普通',         label: '普通' },
      { value: '気にしない',   label: '気にしない' },
    ],
  },
]

// ── Wizard 状態 ──────────────────────────────────────────────────
// step が 0 のときは destination 選択画面（QUESTIONS[0] = destination）。
// step が 1〜5 のときは QUESTIONS[step] の通常設問。
type WizardState =
  | { phase: 'q'; index: number }
  | { phase: 'loading' }
  | { phase: 'result'; recs: Recommendation[]; isFallback?: boolean; isCached?: boolean }
  | { phase: 'error'; message: string; canRetry: boolean }

/** 30 fixed slug、または custom destination の station code/name を保持する union。 */
export type WizardDestination =
  | { kind: 'fixed';  slug: FixedDestination }
  | { kind: 'custom'; station: CustomStation }

interface Props {
  /** 任意 — DestinationAsk 等で既に通勤先が決まっていれば Q1 に予選択しておく */
  initialDestination?: FixedDestination
  /**
   * キャッシュされた過去の推薦結果。提供されれば Q1-Q6 / loading をスキップして
   * 直接 result phase で起動する（24h 以内の「もう一度見る」フロー用）。
   * destination は fixed slug の場合は string、custom の場合は WizardDestination object。
   */
  cachedResult?: {
    recs:        Recommendation[]
    destination: WizardDestination
  }
  /** 1843 駅リスト — Q1 検索 autocomplete 用 */
  stationList:         CustomStation[]
  /** 客户端 Dijkstra 用グラフ — custom destination 選択時に通勤算出 */
  graph:               PreparedGraph | null
  /**
   * Wizard を閉じる。
   * destination は Wizard 内で選択された通勤先（Q1 まで進んでいない場合は null）。
   * 親側はこれを受けて地図を mount し、Map 表示に切替える。
   */
  onClose:             (destination: WizardDestination | null) => void
  /**
   * 結果カードクリック時。destination + 該当駅名を親に通知。
   * 親側は地図を mount + 該当駅の drawer を開く。
   */
  onResolve:           (destination: WizardDestination, stationName: string) => void
  /**
   * OpenAI 真調用 / fallback / cache 命中いずれかで result が確定した瞬間に呼ばれる。
   * 親側は recs + destination を保存して、後で AiRecallButton から再表示できるようにする。
   * cachedResult から起動した場合は呼ばれない（既に親側に存在しているため）。
   */
  onResultReady?:      (destination: WizardDestination, recs: Recommendation[]) => void
}

/**
 * Wizard 内累積 state — partial answers + custom destination 専用 field。
 * 'custom' destination 時は customStation + commuteByCode（client Dijkstra 結果）を保持。
 */
type WizardPartial =
  Partial<WizardAnswers> & {
    customStation?: CustomStation
    commuteByCode?: CommuteByCode
  }

export default function AiWizard({
  initialDestination,
  cachedResult,
  stationList,
  graph,
  onClose,
  onResolve,
  onResultReady,
}: Props) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  // cachedResult があれば即 result phase（リコール経路）。
  // それ以外は Q1 (destination) または initialDestination で Q2 から開始。
  const [state, setState] = useState<WizardState>(
    cachedResult
      ? { phase: 'result', recs: cachedResult.recs, isCached: true }
      : { phase: 'q', index: initialDestination ? 1 : 0 }
  )
  // 部分答案累積（partial - 最後の質問まではすべて埋まっていない）
  const partialRef = useRef<WizardPartial>(
    cachedResult
      ? cachedResult.destination.kind === 'fixed'
        ? { destination: cachedResult.destination.slug }
        : { destination: 'custom', customStation: cachedResult.destination.station }
      : initialDestination ? { destination: initialDestination } : {}
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  /** QuestionView / ResultView の destinationLabel 用 — fixed slug は displayName、custom は station 名。 */
  function destLabel(): string {
    const d = partialRef.current.destination
    if (!d) return ''
    if (d === 'custom') {
      return partialRef.current.customStation?.name ?? ''
    }
    return getDestinationDisplayName(d as FixedDestination)
  }

  /** partialRef から WizardDestination object を再構築（partial が完備な前提）。 */
  function currentWizardDest(): WizardDestination | null {
    const d = partialRef.current.destination
    if (!d) return null
    if (d === 'custom') {
      const cs = partialRef.current.customStation
      return cs ? { kind: 'custom', station: cs } : null
    }
    return { kind: 'fixed', slug: d as FixedDestination }
  }

  function handleClose() {
    if (closing) return
    setClosing(true)
    const dest = currentWizardDest()
    window.setTimeout(() => onClose(dest), 700)
  }

  // 結果カードクリック専用 — destination + 駅名を親に渡す
  function handleResolve(stationName: string) {
    if (closing) return
    setClosing(true)
    const dest = currentWizardDest()
    if (!dest) {
      // 防御的: destination 必須のはずだが万一無い場合は通常 close で fallback
      window.setTimeout(() => onClose(null), 700)
      return
    }
    window.setTimeout(() => onResolve(dest, stationName), 700)
  }

  function answerQuestion(value: AnswerValue | FixedDestination) {
    if (state.phase !== 'q') return
    if (state.index === 0) {
      // Q1: fixed destination 選択（custom は handleCustomDestination 経由）
      partialRef.current.destination = value as FixedDestination
      // 念のため custom 残骸をクリア
      delete partialRef.current.customStation
      delete partialRef.current.commuteByCode
    } else {
      const q = QUESTIONS[state.index - 1]  // index 1..5 → QUESTIONS[0..4]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partialRef.current[q.key] = value as any
    }

    const next = state.index + 1
    // index 0 = destination, 1..5 = QUESTIONS[0..4] → 全 6 step
    if (next <= QUESTIONS.length) {
      setState({ phase: 'q', index: next })
    } else {
      // 全部回答 → loading
      void runRecommend()
    }
  }

  /**
   * Q1 で custom destination が選択された時の handler。
   * graph が ready でない場合は静かに無視（DestinationView 側で button disable される）。
   */
  function handleCustomDestination(station: CustomStation) {
    if (state.phase !== 'q' || state.index !== 0) return
    if (!graph) return
    // client Dijkstra で 1843 駅 → custom 駅 の通勤を算出
    // computeCommutes は Map<code, {mins, transfers}> を返す
    const map = computeCommutes(graph, station.code)
    const commuteByCode: CommuteByCode = {}
    map.forEach((v, code) => {
      commuteByCode[code] = { min: v.mins, transfers: v.transfers }
    })
    partialRef.current.destination = 'custom'
    partialRef.current.customStation = station
    partialRef.current.commuteByCode = commuteByCode
    setState({ phase: 'q', index: 1 })
  }

  function back() {
    if (state.phase !== 'q' || state.index === 0) return
    setState({ phase: 'q', index: state.index - 1 })
  }

  // initialDestination がある場合 Q1 をスキップしているので「戻る」許可も index=2 から
  const minBackIndex = initialDestination ? 2 : 1

  async function runRecommend() {
    setState({ phase: 'loading' })
    const p = partialRef.current
    const answers = {
      destination: p.destination,
      maxMinutes:  p.maxMinutes,
      rentMax:     p.rentMax,
      household:   p.household,
      atmosphere:  p.atmosphere,
      safety:      p.safety,
    } as WizardAnswers
    const deviceId = getDeviceId()
    // custom destination 時は customDestination + commuteByCode を同送
    const customPayload =
      p.destination === 'custom' && p.customStation && p.commuteByCode
        ? {
            customDestination: { code: p.customStation.code, name: p.customStation.name } as CustomDestinationInfo,
            commuteByCode:     p.commuteByCode,
          }
        : {}
    try {
      const res = await fetch('/api/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deviceId, ...answers, ...customPayload }),
      })
      const data = (await res.json()) as RecommendApiResponse

      if (!data.ok) {
        const canRetry = res.status !== 429  // rate limit は再試行不可
        setState({
          phase: 'error',
          message: data.error || '推薦の取得に失敗しました。',
          canRetry,
        })
        return
      }
      setState({
        phase: 'result',
        recs: data.recommendations,
        isFallback: data.fallback,
        isCached: data.cached,
      })
      // 親側に recs + destination を通知（リコール用キャッシュ保存のため）。
      // cachedResult 起動の場合はここに来ない（loading をスキップしているため）。
      const dest = currentWizardDest()
      if (dest && onResultReady) {
        onResultReady(dest, data.recommendations)
      }
    } catch (e) {
      console.error('[AiWizard] /api/recommend failed:', e)
      setState({
        phase: 'error',
        message: 'ネットワークエラーが発生しました。',
        canRetry: true,
      })
    }
  }

  function retry() {
    void runRecommend()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: BG, color: INK,
        fontFamily: 'var(--display-font, "Shippori Mincho","Hiragino Mincho ProN",serif)',
        opacity: closing ? 0 : (mounted ? 1 : 0),
        transition: 'opacity .7s cubic-bezier(.2,.8,.2,1)',
        WebkitFontSmoothing: 'antialiased',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* paper warmth */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 18%, rgba(255,246,228,.55), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(168,51,43,.06), transparent 50%)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: .06, mixBlendMode: 'multiply',
        backgroundImage: 'radial-gradient(rgba(28,24,18,.6) .5px, transparent .6px)',
        backgroundSize: '3px 3px',
      }} />

      {/* close X */}
      <button
        onClick={handleClose}
        aria-label="close"
        style={{
          position: 'fixed', top: 18, right: 22, zIndex: 2,
          width: 36, height: 36,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: DIM,
          fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
          fontSize: 26, lineHeight: 1,
          transition: 'color .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = INK }}
        onMouseLeave={e => { e.currentTarget.style.color = DIM }}
      >
        ×
      </button>

      {/* content switch */}
      {state.phase === 'q' && state.index === 0 && (
        <DestinationView
          index={state.index}
          total={QUESTIONS.length + 1}
          isMobile={isMobile}
          stationList={stationList}
          graphReady={!!graph}
          onAnswer={answerQuestion}
          onAnswerCustom={handleCustomDestination}
          onExit={handleClose}
        />
      )}
      {state.phase === 'q' && state.index > 0 && (
        <QuestionView
          q={QUESTIONS[state.index - 1]}
          index={state.index}
          total={QUESTIONS.length + 1}
          destinationLabel={destLabel()}
          isMobile={isMobile}
          onAnswer={answerQuestion}
          onBack={state.index < minBackIndex ? null : back}
        />
      )}
      {state.phase === 'loading'  && <LoadingView isMobile={isMobile} />}
      {state.phase === 'result'   && (
        <ResultView
          recs={state.recs}
          destinationLabel={destLabel()}
          isFallback={state.isFallback}
          isCached={state.isCached}
          onStationClick={handleResolve}
          onCtaClick={handleClose}
        />
      )}
      {state.phase === 'error' && (
        <ErrorView
          message={state.message}
          canRetry={state.canRetry}
          onRetry={retry}
          onClose={handleClose}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

// ── Q1: 通勤先選択ビュー ──────────────────────────────────────────
// 検索 input + autocomplete dropdown（任意の 1843 駅）+ QUICK 3 駅 大ボタン
// + 「他から選ぶ」展開で POPULAR 27 駅 chip。
// DestinationAsk と視覚的に統一。
function DestinationView({
  index,
  total,
  isMobile,
  stationList,
  graphReady,
  onAnswer,
  onAnswerCustom,
  onExit,
}: {
  index:          number
  total:          number
  isMobile:       boolean
  /** 1843 駅 list — 検索 autocomplete 用 */
  stationList:    CustomStation[]
  /** graph.json がロード済みか — false の時は検索結果クリックを silently disable */
  graphReady:     boolean
  onAnswer:       (value: FixedDestination) => void
  /** Custom destination 選択時のハンドラ — Wizard が client Dijkstra で commute 算出 */
  onAnswerCustom: (station: CustomStation) => void
  /** 30 駅に通勤先が無い user 向けの退出ハンドラ — Wizard を閉じて地図へ戻る */
  onExit:         () => void
}) {
  const [showMore, setShowMore] = useState(false)
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 駅名検索の事前計算 — 1843 駅に対して「主名・別名・軽量化版」の組合せキーを作る。
  // station_database は「四ツ谷(四ッ谷)」「霞ケ関」のような表記揺れを含むため、
  // 「四谷」入力で「四ツ谷」にヒットさせるには小カナ削除等の正規化が必須。
  const searchIndex = useMemo(() => {
    return stationList.map(s => ({ station: s, keys: buildSearchKeys(s.name) }))
  }, [stationList])

  const filtered = useMemo(() => {
    if (query.length < 1) return []
    const q = query
    const qNorm = normalizeForSearch(query)
    const out: CustomStation[] = []
    for (const { station, keys } of searchIndex) {
      // 主名 / 別名 / 正規化版 のどれかに query または normalized query が部分一致すればヒット
      if (keys.some(k => k.includes(q) || (qNorm && k.includes(qNorm)))) {
        out.push(station)
        if (out.length >= 8) break
      }
    }
    return out
  }, [query, searchIndex])

  function selectStation(s: CustomStation) {
    if (!graphReady) return
    setQuery('')
    setShowDropdown(false)
    onAnswerCustom(s)
  }
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '90px 5vw 60px' : '8vh 6vw',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : 640,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* progress smallcaps */}
        <div
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '.4em', textTransform: 'uppercase',
            color: DIM,
            marginBottom: isMobile ? 14 : 18,
          }}
        >
          Question {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>

        {/* italic prelude */}
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 'clamp(18px, 5.4vw, 24px)' : 'clamp(24px, 2.6vw, 34px)',
            color: RED,
            margin: 0,
            letterSpacing: '-.01em',
            lineHeight: 1.15,
          }}
        >
          where do you commute?
        </p>

        {/* 主題 */}
        <h1
          style={{
            margin: isMobile ? '18px 0 30px' : '24px 0 40px',
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 'clamp(22px, 6.2vw, 30px)' : 'clamp(28px, 3.2vw, 40px)',
            lineHeight: 1.3,
            letterSpacing: '.06em',
            color: INK,
          }}
        >
          通勤先を一つ選んでください
        </h1>

        {/* 検索 input + autocomplete — 任意の 1843 駅
            graph 未ロード時は input 自体は使えるが、結果クリック時は selectStation 内で silent ignore */}
        <div style={{ position: 'relative', maxWidth: 360, margin: '0 auto 24px' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => window.setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setQuery(''); setShowDropdown(false); inputRef.current?.blur() }
              if (e.key === 'Enter' && filtered.length > 0) selectStation(filtered[0])
            }}
            placeholder={graphReady ? '駅名で検索...' : '読込中...'}
            disabled={!graphReady}
            style={{
              width: '100%',
              padding: isMobile ? '10px 14px' : '11px 16px',
              background: 'rgba(255,255,255,.55)',
              border: `.5px solid rgba(28,24,18,.28)`,
              borderRadius: 0,
              fontFamily: 'var(--ui-font, system-ui, sans-serif)',
              fontSize: isMobile ? 13 : 14,
              color: INK,
              outline: 'none',
              transition: 'border-color .2s, background .2s',
              boxSizing: 'border-box',
            }}
            onFocusCapture={e => {
              e.currentTarget.style.borderColor = INK
              e.currentTarget.style.background = 'rgba(255,255,255,.85)'
            }}
            onBlurCapture={e => {
              e.currentTarget.style.borderColor = 'rgba(28,24,18,.28)'
              e.currentTarget.style.background = 'rgba(255,255,255,.55)'
            }}
          />
          {showDropdown && filtered.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0, right: 0,
                background: 'rgba(244, 241, 234, 0.97)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: '.5px solid rgba(28,24,18,.18)',
                zIndex: 5,
                maxHeight: 260, overflowY: 'auto',
                textAlign: 'left',
              }}
            >
              {filtered.map(s => (
                <button
                  key={s.code}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectStation(s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: isMobile ? '10px 14px' : '11px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '.5px solid rgba(28,24,18,.08)',
                    fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
                    fontSize: isMobile ? 13 : 14,
                    color: INK,
                    letterSpacing: '.04em',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,51,43,.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 副標題 — 検索 input と QUICK 駅の橋渡し */}
        <p
          style={{
            margin: '0 0 12px 0',
            fontFamily: 'var(--display-italic, "Cormorant Garamond", serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 12 : 13,
            color: DIM,
            letterSpacing: '.02em',
          }}
        >
          または人気駅から：
        </p>

        {/* QUICK 3 駅 — 大ボタン */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: isMobile ? 10 : 14,
            margin: '0 auto 18px',
            maxWidth: 560,
          }}
        >
          {QUICK_DESTINATIONS.map(opt => (
            <button
              key={opt.slug}
              onClick={() => onAnswer(opt.slug as FixedDestination)}
              style={{
                padding: isMobile ? '12px 22px' : '14px 30px',
                background: 'transparent',
                border: `.5px solid ${INK}`,
                color: INK,
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: isMobile ? 14 : 15,
                letterSpacing: '.06em',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all .25s',
                minWidth: isMobile ? 100 : 130,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = RED
                e.currentTarget.style.color = '#f5e7d2'
                e.currentTarget.style.borderColor = RED
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = INK
                e.currentTarget.style.borderColor = INK
              }}
            >
              {opt.displayName}
            </button>
          ))}
        </div>

        {/* Popular 27 駅 — 展開可能 */}
        {!showMore ? (
          <button
            onClick={() => setShowMore(true)}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.06em',
              color: DIM,
              cursor: 'pointer',
              padding: 4,
              transition: 'color .25s',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = INK }}
            onMouseLeave={e => { e.currentTarget.style.color = DIM }}
          >
            他の人気通勤先 27 駅 ▼
          </button>
        ) : (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: isMobile ? 6 : 8,
              justifyContent: 'center',
              maxWidth: '100%',
            }}
          >
            {POPULAR_DESTINATIONS.map(opt => (
              <button
                key={opt.slug}
                onClick={() => onAnswer(opt.slug as FixedDestination)}
                style={{
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  background: 'rgba(255,255,255,.4)',
                  border: '.5px solid rgba(28,24,18,.25)',
                  color: INK,
                  fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                  fontWeight: 500,
                  fontSize: isMobile ? 12 : 12.5,
                  letterSpacing: '.04em',
                  borderRadius: 0,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = RED
                  e.currentTarget.style.color = '#f5e7d2'
                  e.currentTarget.style.borderColor = RED
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,.4)'
                  e.currentTarget.style.color = INK
                  e.currentTarget.style.borderColor = 'rgba(28,24,18,.25)'
                }}
              >
                {opt.displayName}
              </button>
            ))}
          </div>
        )}

        {/* hint + 退出口 — 30 駅に通勤先がない user の救済路 (#5)
            右上の × も同等動作だが、明示的な戻り CTA で死路 UX を防止する。
            「順次追加」の一文で「いつか自分の駅も対応される」期待を残す。 */}
        <div style={{ marginTop: 28 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 11,
              color: DIM,
              letterSpacing: '.02em',
            }}
          >
            AI 推薦は通勤先として全 1843 駅に対応しています。検索または下記の人気駅からお選びください。
          </p>
          <button
            onClick={onExit}
            style={{
              marginTop: 16,
              background: 'transparent',
              border: 'none',
              padding: '6px 4px',
              cursor: 'pointer',
              color: INK,
              fontFamily: 'var(--display-font, "Shippori Mincho", serif)',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 500,
              letterSpacing: '.06em',
              transition: 'color .2s',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = RED }}
            onMouseLeave={e => { e.currentTarget.style.color = INK }}
          >
            ← 自分で探したい方は、地図へ戻る
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 質問ビュー（一問一屏） ────────────────────────────────────────
function QuestionView({
  q,
  index,
  total,
  destinationLabel,
  isMobile,
  onAnswer,
  onBack,
}: {
  q:                QuestionDef
  index:            number
  total:            number
  destinationLabel: string
  isMobile:         boolean
  onAnswer:         (value: AnswerValue) => void
  onBack:           (() => void) | null
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '90px 5vw 60px' : '8vh 6vw',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : 640,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* progress smallcaps */}
        <div
          style={{
            fontFamily: 'var(--mono, "JetBrains Mono",monospace)',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: '.4em', textTransform: 'uppercase',
            color: DIM,
            marginBottom: isMobile ? 14 : 18,
          }}
        >
          Question {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          {' · '}
          {destinationLabel} へ
        </div>

        {/* italic prelude */}
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 'clamp(18px, 5.4vw, 24px)' : 'clamp(24px, 2.6vw, 34px)',
            color: RED,
            margin: 0,
            letterSpacing: '-.01em',
            lineHeight: 1.15,
          }}
        >
          {q.prelude}
        </p>

        {/* 主題 — 明朝大字 */}
        <h1
          style={{
            margin: isMobile ? '18px 0 32px' : '24px 0 44px',
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 'clamp(22px, 6.2vw, 30px)' : 'clamp(28px, 3.2vw, 40px)',
            lineHeight: 1.3,
            letterSpacing: '.06em',
            color: INK,
          }}
        >
          {q.title}
        </h1>

        {/* options — flex wrap */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: isMobile ? 10 : 14,
            margin: '0 auto',
            maxWidth: 560,
          }}
        >
          {q.options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(opt.value)}
              style={{
                padding: isMobile ? '12px 18px' : '14px 26px',
                background: 'transparent',
                border: `.5px solid ${INK}`,
                color: INK,
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: isMobile ? 14 : 15,
                letterSpacing: '.06em',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all .25s',
                minWidth: isMobile ? 124 : 144,
              } as CSSProperties}
              onMouseEnter={e => {
                e.currentTarget.style.background = RED
                e.currentTarget.style.color = '#f5e7d2'
                e.currentTarget.style.borderColor = RED
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = INK
                e.currentTarget.style.borderColor = INK
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 「{destination} へ通勤」の小さな context */}
        {destinationLabel && (
          <p
            style={{
              marginTop: isMobile ? 24 : 30,
              fontFamily: 'var(--display-italic, Garamond, serif)',
              fontStyle: 'italic',
              fontSize: 11,
              color: DIM,
              letterSpacing: '.04em',
            }}
          >
            {destinationLabel} への通勤を前提に
          </p>
        )}

        {/* back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              marginTop: isMobile ? 36 : 48,
              background: 'transparent', border: 'none',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontSize: isMobile ? 12 : 13,
              letterSpacing: '.08em',
              color: DIM,
              cursor: 'pointer',
              padding: 4,
              transition: 'color .25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = INK }}
            onMouseLeave={e => { e.currentTarget.style.color = DIM }}
          >
            ← 一つ戻る
          </button>
        )}
      </div>
    </div>
  )
}

// ── ローディングビュー ───────────────────────────────────────────
function LoadingView({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '60px 5vw' : '8vh 6vw',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* compass-like spinner */}
        <div
          style={{
            display: 'inline-block',
            width: 56, height: 56,
            border: `1px solid ${INK}33`,
            borderTopColor: RED,
            borderRadius: '50%',
            animation: 'tcmWizardSpin 1.2s linear infinite',
          }}
        />
        {/* keyframes 注入 — Tailwind 設定に触らず inline で */}
        <style>{`@keyframes tcmWizardSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

        <p
          style={{
            marginTop: 32,
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 22 : 28,
            color: RED,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          searching for your places…
        </p>
        <p
          style={{
            marginTop: 14,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: isMobile ? 14 : 15,
            color: INK,
            letterSpacing: '.06em',
            lineHeight: 1.8,
          }}
        >
          1,843 駅の中から、<br />あなたに合う 20 駅を選んでいます。
        </p>
        <p
          style={{
            marginTop: 18,
            fontFamily: 'var(--display-italic, Garamond, serif)',
            fontStyle: 'italic',
            fontSize: 11,
            color: DIM,
          }}
        >
          通常 5 〜 10 秒かかります
        </p>
      </div>
    </div>
  )
}

// ── 結果ビュー（AiResultGrid wrap） ───────────────────────────────
function ResultView({
  recs,
  destinationLabel,
  isFallback,
  isCached,
  onStationClick,
  onCtaClick,
}: {
  recs:             Recommendation[]
  destinationLabel: string
  isFallback?:      boolean
  isCached?:        boolean
  onStationClick:   (name: string) => void
  onCtaClick:       () => void
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        padding: '60px 4vw 60px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <AiResultGrid
        recs={recs}
        destinationLabel={destinationLabel}
        isFallback={isFallback}
        isCached={isCached}
        onStationClick={onStationClick}
        onCtaClick={onCtaClick}
      />
    </div>
  )
}

// ── エラービュー ──────────────────────────────────────────────────
function ErrorView({
  message,
  canRetry,
  onRetry,
  onClose,
  isMobile,
}: {
  message:  string
  canRetry: boolean
  onRetry:  () => void
  onClose:  () => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '60px 5vw' : '8vh 6vw',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p
          style={{
            fontFamily: 'var(--display-italic, "Cormorant Garamond",serif)',
            fontStyle: 'italic',
            fontSize: isMobile ? 22 : 28,
            color: RED,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          a small detour…
        </p>
        <h2
          style={{
            marginTop: 14,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontWeight: 600,
            fontSize: isMobile ? 22 : 26,
            color: INK,
            letterSpacing: '.06em',
          }}
        >
          推薦を取得できませんでした
        </h2>
        <p
          style={{
            marginTop: 18,
            fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
            fontSize: 14,
            color: '#3a312a',
            lineHeight: 1.8,
            letterSpacing: '.02em',
          }}
        >
          {message}
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {canRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '12px 26px',
                background: INK,
                color: '#f5e7d2',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '.08em',
                borderRadius: 0,
              }}
            >
              もう一度試す
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '12px 26px',
              background: 'transparent',
              color: INK,
              border: `.5px solid ${INK}`,
              cursor: 'pointer',
              fontFamily: 'var(--display-font, "Shippori Mincho",serif)',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '.08em',
              borderRadius: 0,
            }}
          >
            地図に戻る
          </button>
        </div>
      </div>
    </div>
  )
}
