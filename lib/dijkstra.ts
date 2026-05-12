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
}

export function computeCommutes(
  graph: PreparedGraph,
  source: number,
): Map<number, CommuteResult> {
  const { adj, params } = graph
  const { transferWalkMin, minHeadwayMin, maxHeadwayMin, cutoffMin } = params

  // best[station][curRoute] = [mins, xfers, lastEfreq]
  // station -> Map<curRoute, [mins, xfers, lastEfreq]>
  const best = new Map<number, Map<number, [number, number, number]>>()

  const heap = new MinHeap()
  // 始点は curRoute = -1（未割当）
  heap.push([0, 0, source, -1, 0])

  while (heap.size > 0) {
    const [mins, xfers, station, curRoute, lastEfreq] = heap.pop()!

    let stationBest = best.get(station)
    if (!stationBest) {
      stationBest = new Map()
      best.set(station, stationBest)
    }
    if (stationBest.has(curRoute)) continue
    stationBest.set(curRoute, [mins, xfers, lastEfreq])

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
      if (toBest && toBest.has(newRoute)) continue
      heap.push([newMins, newXfers, to, newRoute, newEfreq])
    }
  }

  // 各 station に対し best_per_station 相当の処理
  // best[station][curRoute] -> 初乗り待ち時間を加えた totalMins の最小値を選ぶ
  const result = new Map<number, CommuteResult>()
  for (const [station, perRoute] of best) {
    if (station === source) continue
    let bestTotal:    number | null = null
    let bestTransfers: number = 0
    for (const [curRoute, [mins, xfers, lastEfreq]] of perRoute) {
      if (curRoute === -1) continue
      const wait = lastEfreq > 0
        ? headwayToWait(lastEfreq, minHeadwayMin, maxHeadwayMin)
        : maxHeadwayMin
      const total = mins + wait
      if (bestTotal === null || total < bestTotal) {
        bestTotal     = total
        bestTransfers = xfers
      }
    }
    if (bestTotal !== null) {
      result.set(station, {
        mins:      Math.round(bestTotal),
        transfers: bestTransfers,
      })
    }
  }
  return result
}
