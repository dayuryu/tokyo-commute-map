// lib/dijkstra.ts
// クライアント側 Dijkstra — カスタム目的地に対して GTFS 高精度通勤時間を計算。
// Python 版 (scripts/build_stations_geojson_v3.py の dijkstra_v3) を 1:1 で移植。
//
// 使い方:
//   const graph = await fetch('/data/graph.json').then(r => r.json())
//   const result = computeCommutes(graph, sourceStationCode)
//   result[stationCode] = { mins, transfers }

interface RawEdge {
  a: number   // station code A
  b: number   // station code B
  t: number   // travel min (cross-route pooled median)
  p: number   // primary route index
  r: number[] // all route indices passing through this edge
  f: number   // edge_freq_total (trips/hour, summed across routes)
}

export interface GraphData {
  version: string
  routes:  string[]
  edges:   RawEdge[]
  params: {
    transferWalkMin: number
    minHeadwayMin:   number
    maxHeadwayMin:   number
    cutoffMin:       number
  }
}

// adjacency: { stationCode: [{ to, travel, primaryRoute, routes (Set), freq }, ...] }
interface AdjEdge {
  to:           number
  travel:       number
  primaryRoute: number
  routes:       Set<number>
  freq:         number
}
type Adjacency = Map<number, AdjEdge[]>

export interface PreparedGraph {
  adj:    Adjacency
  params: GraphData['params']
}

export function prepareGraph(raw: GraphData): PreparedGraph {
  const adj: Adjacency = new Map()
  const push = (from: number, edge: AdjEdge) => {
    let list = adj.get(from)
    if (!list) { list = []; adj.set(from, list) }
    list.push(edge)
  }
  for (const e of raw.edges) {
    const routes = new Set(e.r)
    push(e.a, { to: e.b, travel: e.t, primaryRoute: e.p, routes, freq: e.f })
    push(e.b, { to: e.a, travel: e.t, primaryRoute: e.p, routes, freq: e.f })
  }
  return { adj, params: raw.params }
}

function headwayToWait(tripsPerHour: number, minH: number, maxH: number): number {
  if (tripsPerHour <= 0) return maxH
  const halfHeadway = 30.0 / tripsPerHour
  return Math.max(minH, Math.min(maxH, halfHeadway))
}

// ── Binary min-heap ──────────────────────────────────────────────────────
// State tuple stored as [mins, xfers, station, curRoute, lastEfreq].
// curRoute === -1 表す「ルート未割当」（始点）
type State = [number, number, number, number, number]

class MinHeap {
  private data: State[] = []
  push(s: State) {
    this.data.push(s)
    this.bubbleUp(this.data.length - 1)
  }
  pop(): State | undefined {
    if (this.data.length === 0) return undefined
    const top = this.data[0]
    const last = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = last
      this.sinkDown(0)
    }
    return top
  }
  get size() { return this.data.length }

  private bubbleUp(i: number) {
    const d = this.data
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (d[i][0] < d[parent][0]) {
        [d[i], d[parent]] = [d[parent], d[i]]
        i = parent
      } else break
    }
  }
  private sinkDown(i: number) {
    const d = this.data
    const n = d.length
    for (;;) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let smallest = i
      if (l < n && d[l][0] < d[smallest][0]) smallest = l
      if (r < n && d[r][0] < d[smallest][0]) smallest = r
      if (smallest !== i) {
        [d[i], d[smallest]] = [d[smallest], d[i]]
        i = smallest
      } else break
    }
  }
}

// ── Main computation ─────────────────────────────────────────────────────
//
// Python 版と完全一致するロジック：
//  1. 始点から Dijkstra で各 (station, curRoute) に対する最小時間を求める
//  2. station ごとに「経路上ボトルネック edge_freq から算出した初乗り待ち時間」を
//     mins に加算し、最小値を採用
//
// Returns: { [stationCode]: { mins, transfers } }
// 始点自身は含まれない（mins = 0 自明のため）
export interface CommuteResult {
  mins:      number
  transfers: number
  // ▼ 乗換上限フィルタ用の付加情報（client 側のみ算出）。
  //   t0 = 乗換 0 回（直通一本道）で到達できる最短総時間。到達不能なら null。
  //   t1 = 乗換 1 回以内で到達できる最短総時間。到達不能なら null。
  //   mins/transfers は「最速経路」の値であり、最速が乗換ありだと一本道情報が
  //   失われる。乗換上限フィルタはこの t0/t1 を見ることで一本道駅の取りこぼしを防ぐ。
  //   注: mins/transfers 自体は従来と byte 一致（Python dijkstra_v3 との 1:1 を保つ）。
  t0:        number | null
  t1:        number | null
}

export function computeCommutes(
  graph: PreparedGraph,
  source: number,
): Map<number, CommuteResult> {
  const { adj, params } = graph
  const { transferWalkMin, minHeadwayMin, maxHeadwayMin, cutoffMin } = params

  // best[station][enc(curRoute, min(xfers,2))] = [mins, xfers, lastEfreq, curRoute]
  // 乗換次元を key に加えることで「乗換ありの高速経路」が「乗換 0 の一本道到達」を
  // 同一 (station,route) slot から押し出す現象を防ぐ（フィルタ取りこぼしの根治）。
  // xfers は 0/1/2+ の 3 段に丸める（UI の乗換上限が 0/1 の 2 段しか無いため十分）。
  const enc = (route: number, xfers: number) => route * 4 + (xfers > 2 ? 2 : xfers)
  const best = new Map<number, Map<number, [number, number, number, number]>>()

  const heap = new MinHeap()
  // 始点は curRoute = -1（未割当）
  heap.push([0, 0, source, -1, 0])

  while (heap.size > 0) {
    const [mins, xfers, station, curRoute, lastEfreq] = heap.pop()!
    const key = enc(curRoute, xfers)

    let stationBest = best.get(station)
    if (!stationBest) {
      stationBest = new Map()
      best.set(station, stationBest)
    }
    if (stationBest.has(key)) continue
    stationBest.set(key, [mins, xfers, lastEfreq, curRoute])

    if (mins >= cutoffMin) continue

    const neighbors = adj.get(station)
    if (!neighbors) continue

    for (const edge of neighbors) {
      const { to, travel, primaryRoute, routes, freq } = edge

      const canStay = curRoute !== -1 && routes.has(curRoute)

      let newMins:    number
      let newXfers:   number
      let newRoute:   number
      let newEfreq:   number

      if (curRoute === -1) {
        // 始点：乗換ペナルティなし
        newMins  = mins + travel
        newXfers = xfers
        newRoute = primaryRoute
        newEfreq = freq
      } else if (canStay) {
        // 同ルート維持
        newMins  = mins + travel
        newXfers = xfers
        newRoute = curRoute
        newEfreq = freq > 0 ? Math.min(lastEfreq, freq) : lastEfreq
      } else {
        // 乗換
        const transferWait = freq > 0
          ? headwayToWait(freq, minHeadwayMin, maxHeadwayMin)
          : maxHeadwayMin
        const transferCost = transferWalkMin + transferWait
        newMins  = mins + travel + transferCost
        newXfers = xfers + 1
        newRoute = primaryRoute
        newEfreq = freq
      }

      if (newMins > cutoffMin) continue
      const toBest = best.get(to)
      if (toBest && toBest.has(enc(newRoute, newXfers))) continue
      heap.push([newMins, newXfers, to, newRoute, newEfreq])
    }
  }

  // 各 station に対し best_per_station 相当の処理
  // best[station][curRoute] -> 初乗り待ち時間を加えた totalMins の最小値を選ぶ
  const result = new Map<number, CommuteResult>()
  for (const [station, perKey] of best) {
    if (station === source) continue

    // ── unlimited（mins/transfers）── 従来ロジックの完全再現。
    // route ごとに min-mins 条目のみを残し（旧 best_per_route と等価）、その上で
    // route 横断の min-total を採る。乗換次元 slot を加えても min-mins 条目＝従来の
    // 唯一生存条目なので、出力は従来と byte 一致する（1:1 不変量を保つ）。
    const minMinsByRoute = new Map<number, [number, number, number]>() // route -> [mins,xfers,lastEfreq]
    for (const [, [mins, xfers, lastEfreq, curRoute]] of perKey) {
      if (curRoute === -1) continue
      const cur = minMinsByRoute.get(curRoute)
      if (!cur || mins < cur[0]) minMinsByRoute.set(curRoute, [mins, xfers, lastEfreq])
    }
    let bestTotal:     number | null = null
    let bestTransfers: number = 0
    for (const [, [mins, xfers, lastEfreq]] of minMinsByRoute) {
      const wait = lastEfreq > 0
        ? headwayToWait(lastEfreq, minHeadwayMin, maxHeadwayMin)
        : maxHeadwayMin
      const total = mins + wait
      if (bestTotal === null || total < bestTotal) {
        bestTotal     = total
        bestTransfers = xfers
      }
    }

    // ── t0 / t1 ── 乗換 0 回 / 1 回以内で到達できる最短総時間（乗換上限フィルタ用）。
    // unlimited の min-mins 制約は掛けず、全 slot を走査する。
    let t0: number | null = null
    let t1: number | null = null
    for (const [, [mins, xfers, lastEfreq]] of perKey) {
      const total = mins + (lastEfreq > 0
        ? headwayToWait(lastEfreq, minHeadwayMin, maxHeadwayMin)
        : maxHeadwayMin)
      if (xfers === 0 && (t0 === null || total < t0)) t0 = total
      if (xfers <= 1 && (t1 === null || total < t1)) t1 = total
    }

    if (bestTotal !== null) {
      result.set(station, {
        mins:      Math.round(bestTotal),
        transfers: bestTransfers,
        t0:        t0 === null ? null : Math.round(t0),
        t1:        t1 === null ? null : Math.round(t1),
      })
    }
  }
  return result
}
