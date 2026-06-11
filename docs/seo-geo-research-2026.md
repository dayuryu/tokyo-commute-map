# Kayoha SEO/AEO/GEO 调查报告（2026-06）

> 2026-06-11 调查。方法：5 个搜索角度并行扫日英文资料 → 抓取 23 个来源 → 提取 114 条可证伪结论 → 对 25 条关键结论做 3 票对抗性核查（20 confirmed / 5 killed）→ 合成。
> 调查目标：日均几百 UV、搬家旺季（1-3 月）几千 UV/天，全靠 organic + AI 引用 + 社交。
> **诚实声明**：搜索量分布、GEO 具体战术（schema 偏好/答案优先写法实效/llms.txt）、SUUMO/HOME'S 的 AEO 布局、AI 引用测量方法——这四块**没有幸存证据**，相关建议标注为推论，需第二轮验证。

---

## 一、总结论

1. **1831 站页工程：竞争上有明确缝隙，政策上有可控但真实的风险。**
   最直接的大手竞品スマイティ（Kakaku.com 系）已做了全国站级程序化页面，但**没有通勤时间数据**；编辑型的 itot 覆盖 3300+ 区域但纯人工采编、不做数据页。**GTFS 实算通勤时间矩阵是 Kayoha 对最强竞品的唯一独有维度**，模板必须围绕它设计。
2. **Google 红线真实存在**：2024-03 确立、2026-03 升级执法的 scaled content abuse 政策，重点打击「只换地名的同模板地点页」。反面教材：G2 流量约 -80%、ZoomInfo 崩盘。
3. **AI 搜索在日本已成第二战场**：约 37% 网民在搜索场景用生成 AI；ChatGPT 单一入口最大（29.1%），但 Google 系（AI モード 21.0% + AIO + Gemini 15.6%/+5.2pt）合计触点更大且增速更快 → **GEO 必须双线**。Perplexity 在日本仅 4%，优先级靠后。
4. **「被引用」的价值在超越「排第一」**：日本市场 AIO 出现时第 1 位 CTR 约 -37.8%（Ahrefs，全球趋势 -34.5%→-58.0% 还在恶化）。站页要按「可被 AI 摘录」的形态设计，不只是按排名设计。
5. **AI 引用池里没有不动产垂直站**：日语查询引用 top 域名是 YouTube/Wikipedia/note.com/Amazon/PR TIMES 等平台。新站没有现成进入路径——独有数据表格 + 稳定 URL 是正路，note/PR TIMES 发数据内容可能是间接通道（要二次验证）。

---

## 二、核心发现（全部经 3 票对抗核查）

### F1. 竞品格局：スマイティ是最直接竞品，但没有通勤数据 〔置信度：高，3-0×3〕

sumaity.com/town/（Kakaku.com 运营，东证 Prime 系）已实装全国站级独立 URL 页面（如 `/town/tokyo/nakano_ku/nakano-eki/`）。页面构成：行政统计（人口/地价/平均年龄/犯罪率，仅市区级）+ 6 类生活便利度评分 + 用户街评（中野站 105 条，4.41/5）+ 按户型家賃相場表。**2026-06-11 实抓验证：全页无任何通勤时间数据表**，通勤信息只散见于用户评论文本。
→ 房租/评价维度与 Kayoha 重叠（且其评价量大），**通勤时间矩阵是唯一差异化主轴**。
来源：[sumaity.com/town/](https://sumaity.com/town/)、[中野駅页](https://sumaity.com/town/tokyo/nakano_ku/nakano-eki/)、[新宿駅页](https://sumaity.com/town/tokyo/shinjuku_ku/shinjuku-eki/)

### F2. 竞品格局：itot 是编辑型，不正面冲突 〔置信度：高，3-0〕

itot（ココロマチ，2006 年起）累计 3300+ 区域页，编辑部人工采编（生活设施/名店/本地人物），B2B 赞助型模式，不做数据驱动页面。
来源：[cocolomachi.co.jp](https://cocolomachi.co.jp/service/itot)

### F3. Google 政策红线 〔置信度：高，3-0〕

2024-03 核心更新同时发布 scaled content abuse 垃圾政策（官方称低质非原创内容 -45%），覆盖自动/人工/混合量产；2026-03 核心更新（3/27-4/8 rollout）升级执法，多家独立 agency 一致报告「只替换地名变量的同模板地点页」被打击最重。
来源：[Google 官方博客](https://developers.google.com/search/blog/2024/03/core-update-spam-policies)、[Digital Applied 2026-03 分析](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban)

### F4. 模板设计经验阈值 〔置信度：低——机构经验值，非 Google 官方，方向可用数字不可承重〕

业界 heuristic：~6% 独特率（800 字只有 50 字是变量）属高危；建议 30-40% 独特内容比；每页 100-150 字真正的编辑性综述能显著提升；**集合内每页必须回答与其他页「真正不同」的查询；数据库 schema 应设不可为 null 的独有数据列**；「500+ 地点页共用相同正文」被列为高风险。Google 从未发布数值阈值，从业者间分歧大（30-40% 到 ≥50-60%）。

### F5. 索引存留：上线≠永久收录 〔置信度：中，3-0×3〕

约 130 天未被重新抓取的页面 99% 概率掉出索引（Indexing Insight 对 140 万页的研究；2025-05 起 Google 清除低参与度页面可能更快）。反面案例：G2 程序化类目页流量约 -80%（第三方估算）、ZoomInfo 数百万档案页 boom-bust。
→ **1831 页上线后必须靠内链结构 + 数据更新维持抓取信号**，不是发完就完。
来源：[130 天规则](https://indexinginsight.com/blog/the-130-day-indexing-rule)、[AirOps 案例分析](https://www.airops.com/blog/hidden-dangers-of-programmatic-seo)（注：AI 内容厂商，有夸大 pSEO 失败的动机）

### F6. 日本 AI 搜索份额（2026-02） 〔置信度：中——厂商自报调查，排名可信、绝对值打折〕

搜索场景用生成 AI 的网民 37.0%（CyberAgent GEO Lab.，n=9278；2025-05 仅 21.3%）。份额：ChatGPT 29.1%（+3.6pt）> Google AI モード 21.0% > Gemini 15.6%（+5.2pt，10 代达 24.5%）。ICT 总研独立调查佐证排名：ChatGPT 36.2% > Gemini 25.0% > Copilot 13.3% > Claude 4.3% > **Perplexity 4.0%**。
来源：[CyberAgent](https://www.cyberagent.co.jp/news/detail/id=33041)、[ICT 总研](https://prtimes.jp/main/html/rd/p/000000027.000019182.html)

### F7. AIO 的零点击冲击 〔置信度：高，3-0〕

日本市场 AIO 出现时第 1 位 CTR：预期 2.9% → 实际 1.8%（**-37.8%**，Ahrefs，30 万信息型关键词，桌面端）。全球同口径 2025-04 的 -34.5% 恶化到 2025-12 的 -58.0%；Seer/Kevin Indig/Authoritas/SISTRIX 多家独立研究方向一致。
来源：[Ahrefs PR](https://prtimes.jp/main/html/rd/p/000000037.000157671.html)、[Ahrefs 原研究](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/)

### F8. AI 引用池构成 〔置信度：高，3-0〕

日语查询、五个 AI 表面（AI Mode/AIO/ChatGPT/Perplexity/Copilot）2025-12〜2026-03 累计引用 top：YouTube 331.9 万 > 日文 Wikipedia 97.9 万 > Google 90.7 万 > **note.com 38.5 万** > Amazon 36.0 万 > **PR TIMES 9.6 万**。Top10 无不动产垂直站。PR TIMES 引用集中于 ChatGPT（→ 发稿可能是进 ChatGPT 引用池的低成本通道，**此推论要二次验证**）。
来源：[Ahrefs Brand Radar](https://prtimes.jp/main/html/rd/p/000000044.000157671.html)、[Web 担当者 Forum](https://webtan.impress.co.jp/n/2026/04/09/52446)

---

## 三、行动清单（按优先级）

### 🥇 高优先

| # | 做什么 | 预期效果 | 成本 |
|---|---|---|---|
| A1 | **站页工程立项 + 模板设计**。设计原则（来自 F1/F3/F4）：① 通勤时间矩阵表（到 30 通勤地）为页面主角 = 对スマイティ的唯一差异化；② 不可为 null 的独有数据字段：通勤矩阵 + 房租 + area_features + 评价；③ 每页 100-150 字以上非模板的编辑性内容（area_features 可扩写）；④ 独特内容比对照 30-40% 方向校验；⑤ 每页要能回答「这一站独有」的查询 | 通往「旺季几千 UV」的唯一 organic 路径 | 模板设计 + 试点：中。数据已全部在手 |
| A2 | **搜索量分布实测**（本轮调查零幸存证据的最大缺口）。用 ラッコキーワード/Ahrefs/GSC impressions 实测「{駅名} 住みやすさ/家賃相場/一人暮らし」头中长尾量级 → 决定 1831 站分批上线顺序 | 决定先做哪几百站、避免在零搜索量的站上花成本 | 低（工具 + 半天） |
| A3 | **分批上线 + 抓取信号维持机制**（来自 F5）：先 50-100 站试点观察收录率 → 分批扩量；hub/沿线/邻站内链网 + 数据定期更新戳，防 130 天失索引 | 收录率和存留率的保险 | 设计时一并做：低 |
| A4 | **注册 Bing Webmaster Tools + IndexNow**。ChatGPT search 吃 Bing 索引（F6：ChatGPT 是日本第一 AI 入口），目前完全没注册 | 进入 ChatGPT 引用池的前置条件，零风险 | 极低（1 小时） |

### 🥈 中优先

| # | 做什么 | 预期效果 | 成本 |
|---|---|---|---|
| B1 | **GEO 双线改造**（ChatGPT + Google AI 系，F6/F7）：站页开头放直答句（「○○駅から新宿までは最短 XX 分」）、通勤数据用语义化 HTML 表格、URL 永久稳定。具体 schema 偏好**无幸存证据，按通用实践做，标二次验证** | AIO 截流近 4 成点击的环境下，被摘录=新流量来源 | 并入 A1 模板设计：低增量 |
| B2 | **GA4 建 AI referral 基线**：chatgpt.com / perplexity.ai / gemini.google.com / copilot 等 referrer 单独分组，改造前先有基线 | 量化「被 AI 引用」的唯一自有数据 | 低（GA4 配置） |
| B3 | **note.com 数据连载 / PR TIMES 发稿**（F8）：把独有数据做成「東京通勤データ」系列内容带回链发布 | 进入 AI 引用池的间接通道（note 38.5 万引用/PR TIMES 集中于 ChatGPT）；**因果未证，要二次验证** | 中（内容创作持续投入） |

### 🥉 低优先

| # | 做什么 | 预期效果 | 成本 |
|---|---|---|---|
| C1 | 外链建设（最低限度）：数据引用型外联、媒体投稿 | 新域名权威度，慢变量 | 高（持续） |
| C2 | llms.txt | **2026 年无被主流爬虫消费的证据**，先不做 | — |
| C3 | 第二轮调查：对真实住居 query 抽样问各 AI 引擎、记录实际引用源与页面形态 | 补齐本轮零证据的战术层（schema/写法/竞品 AEO） | 低-中 |

---

## 四、未决问题（需二次验证后才能行动的）

1. 「{駅名} 住みやすさ」类查询的实际搜索量分布 → **A2 实测**
2. 住居类查询各 AI 引擎实际引用谁、偏好什么形态；SUUMO/HOME'S 是否已做 AEO → **C3 抽样实验**
3. 新域名零外链下 1831 页的现实收录率；最低限度外链建设的实际效果 → A3 试点的观察指标
4. llms.txt 有效性、GA4 AI referrer 分组最佳实践 → C3 一并验证

## 五、被对抗核查否决的说法（不要再信）

- ❌「AI 量产页面普遍 -50~80% 流量」「地点页 -30~60%」「模板+换实体名本身就是处罚触发条件」——同一来源（Digital Applied）的具体数字三票全否，无数据支撑
- ❌「Google 官方文档明确说大量低价值 URL 损害整站抓取索引」——官方原文无此表述
- ❌「Wise 14,000 程序化页月 460 万访问 = 成功案例」——1-2 否决，第三方估算不可靠。**不要拿这个案例当立项依据**

## 六、来源与方法说明

23 个来源（一手：Google 官方、Ahrefs、CyberAgent、ICT 总研、sumaity/cocolomachi 实抓；其余为 SEO agency 博客，已按利益相关方折扣处理）。市场份额数据全部来自有 GEO/SEO 业务的厂商自报调查，排名方向多方印证、绝对数字仅供量级参考；AI 入口格局单季变化 5pt 级，**本报告市场数据有效期约 6 个月（至 2026 年底）**。
