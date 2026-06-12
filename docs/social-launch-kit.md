# 社交平台启动文案包（2026-06-12 准备，启动日：明天）

> 目的：打 kayoerumap.com 的最快一击 = 外链与曝光（它**零外链**，2-3 条高质量链接即可在域名权重上反超）。
> 日语圈（Zenn/note/Hatena）攻日语 SERP 主战场；Reddit 攻英文流量 + AI 引用（GEO）。
> 所有链接用无 locale 前缀的 canonical URL（`kayoha.com/...`，不带 `/ja`）。

---

## 启动顺序（建议）

| 顺序 | 平台 | 目标 | 备注 |
|---|---|---|---|
| 1 | Zenn | 日语开发者圈外链 + Hatena 弹药 | 先发，后续所有日语曝光的落点 |
| 2 | X（日语） | 给 Zenn 文导流 + 地图/铁道爱好者转发 | Zenn 发出后 1-2 小时内 |
| 3 | Hatena Bookmark | 域名信号 | 自己 bookmark 一条即可，**不要小号刷**，靠 Zenn 文自然带 |
| 4 | r/InternetIsBeautiful | 英文爆款位 | 美国时间工作日早上（日本晚上 21-23 时）发帖效果最好 |
| 5 | r/movingtojapan 等 | 长期回答流 | 不发广告帖，养答题习惯 |

---

## 1. Zenn 开发故事文（日语全文初稿）

**标题候选（选一）：**
- 関東1831駅の「通勤時間マップ」を個人開発した — GTFS実時刻表で全駅を色分けするまで
- 「どこに住む？」を地図で答えたくて、関東1831駅を通勤時間で色分けした話

**正文初稿：**

---

## 作ったもの

通勤先の駅を選ぶと、関東の鉄道全1831駅が「そこまで何分か」で色分けされる地図を作りました。

https://kayoha.com

引っ越しのとき、多くの人は SUUMO で家賃から部屋を探して、内見のあとで「あれ、通勤つらくない？」と気づきます。順番が逆だと思っていました。先に「通える範囲」を地図で見て、それから街と家賃を選びたい。それを実現するツールです。

## 技術スタック

- **フロント**: Next.js (App Router) + MapLibre GL JS。地図タイルは OpenFreeMap
- **経路計算**: GTFS 実時刻表データから全駅間の最短所要時間を事前計算（Dijkstra）。乗換も実ダイヤベース
- **ホスティング**: Vercel。事前計算済みデータを静的配信するので、サーバーで経路探索はしない
- **データ**: 国交省 GTFS オープンデータ + 政府住宅統計（家賃相場）

## いちばん大変だったこと

（※ここは実体験で 2-3 段落埋める。候補トピック：）
- 1831駅 × 30通勤地のマトリクス事前計算と、それを静的 JSON でどう配るか
- MapLibre で 1831 駅を 60fps で色分けレンダリングする工夫
- GTFS の乗換情報の罠（駅名の表記揺れ、同名駅、徒歩連絡）
- CJK フォントと LCP の戦い（next/font の preload が 11MB を引いてくる問題）

## こだわり

- **二拠点通勤**: 共働きで職場が別々の場合、2つの通勤先の max(A,B) で「両方に通いやすいエリア」を合成表示
- **駅ごとのページ**: 主要150駅は家賃相場・街の特徴・30通勤地への所要時間を1ページにまとめた
- **AI 推薦**: 希望条件を伝えると候補駅を理由つきで提案

## 今後

検索流入を見ながら駅ページを1200駅まで拡張予定です。フィードバック歓迎です。

---

**发布要点：**
- 「大変だったこと」段落必须用真实经历填充（Zenn 读者对空洞内容敏感，这段是文章的灵魂）
- 文末不要放多个链接，只放主站一条
- 发布后把文章链接转发到 X

## 2. note 版（角度差异化）

同一素材换角度：不写技术，写**「引っ越しで失敗した話 → だから作った」**的生活叙事。标题候补：
- 家賃で部屋を決めて、通勤で後悔した。だから「通える範囲」から探す地図を作った
- 目标读者：非工程师的引っ越し检讨层（note 的主用户群）
- 篇幅 1500 字左右，截图 2-3 张（地图色分け + 駅詳細）
- 与 Zenn 文间隔 2-3 天发，避免同时刷屏感

## 3. Hatena Bookmark

- 自己给 Zenn 文 + kayoha.com 各 bookmark 一次（合规），**绝对不要小号互刷**（Hatena 对 spam 判定极严，被标记后域名进黑名单反而有害）
- 真正的弹药是 Zenn 文质量：3 users 上「新着」、10+ users 上「人気」，之后是自然滚动

## 4. Reddit — r/InternetIsBeautiful 发帖稿（英文）

**Title（选一，禁用 emoji/感叹号）：**
- I made a map that colors all 1,831 Tokyo-area train stations by commute time to your work
- A map of Greater Tokyo where every station is colored by how long your commute would be

**Post body（comment 区首条自己补充说明，IIB 是 link post）：**

> Hi! I built this because apartment hunting in Tokyo usually starts with rent, and people only realize the commute is brutal after moving in.
>
> You pick your work/school station, and all 1,831 stations in Greater Tokyo get colored by door-to-door train time, computed from actual GTFS timetable data (transfers included). You can filter by max time and number of transfers, and tap any station to see typical rent and a neighborhood guide.
>
> It also handles two workplaces at once (for couples commuting to different offices) — it shades the area that works for both.
>
> Free, no signup. English UI available. Feedback very welcome!

**评论区预答（提前想好，别临场）：**
- "Does it work for [其他城市]?" → Tokyo area only for now; the timetable preprocessing is region-specific, considering expansion if there's interest.
- "What's the data source?" → Japan's open GTFS feeds (MLIT) + government housing statistics for rent.
- "How is this different from Google Maps?" → Google answers "how long from A to B"; this answers "show me every place within N minutes of B" — the inverse query, for all stations at once.
- 技术问题 → 引导到 Zenn 文（如果已发）或简答 precomputed Dijkstra over GTFS graph。

**注意：** IIB 版规允许发自己的作品，但账号最好有少量正常 karma；发完不要马上到处 crosspost。

## 5. Reddit — r/movingtojapan / r/japanlife / r/Tokyo 回答模板

**禁止直接发广告帖**（r/japanlife 明令禁止，r/movingtojapan 对新号链接极严）。打法是回答流：

- 周常驻：r/movingtojapan 的 housing 类提问、r/Tokyo 的 "where to live" 帖
- 回答模板（核心是先给真答案，链接只是注脚）：

> If you're commuting to [Shinjuku] daily, the usual advice is to stay within ~40 min door-to-door. West side along the Chuo line (Nakano, Koenji, Mitaka) gives you good value; if you want cheaper, look northeast (Kita-Senju area). [接 2-3 句针对楼主预算/偏好的具体分析]
>
> I actually built a free map tool that colors every station by commute time to your office, with rent data — might help you compare: kayoha.com (English UI available)

- 账号需要日常参与度（非推广回帖），新号直甩链接 = 删帖 + ban
- 一周 2-3 条高质量回答即可，宁缺毋滥

## 6. X（Twitter）日语 thread 初稿

**Tweet 1（主推）：**
> 「どこに住むか」は家賃じゃなくて通勤時間から決めたい。
>
> 通勤先を選ぶと、関東1831駅が「そこまで何分か」で色分けされる地図を作りました。実際の時刻表データで計算、家賃相場と街の特徴つき。無料・登録不要です。
>
> kayoha.com

**Tweet 2（自回复，二拠点）：**
> 共働きで職場が別々でも、通勤先を2つ設定すると「両方に通いやすいエリア」を合成表示できます。

**Tweet 3（自回复，技术向，Zenn 文链接）：**
> 技術的な話（GTFS実時刻表 × Dijkstra で1831駅×30通勤地を事前計算）はこちらに書きました → [Zenn URL]

- 配图：地图色分け截图（最直观的一张）
- 发布时间：平日 12:00-13:00 或 21:00-22:00 JST
- 给地图/铁道系账号（フォロー中的）不要 @ 轰炸，靠内容自然转发

## 7. 观测

- GSC：「通勤時間マップ」「kayoha」品牌词展示量（社媒启动后 1-2 周看品牌搜索是否抬头）
- GA4：referral 分组（reddit.com / zenn.dev / note.com / t.co / b.hatena.ne.jp）
- Reddit 帖子的 upvote 不重要，重要的是 traffic spike 后的回访率
