import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// 使い方ガイド — 「通勤時間マップ 使い方」「どこに住む 通勤」系クエリの受け皿 +
// ブランド隣接クエリの防衛線。ja 専用（駅頁工程と同方針）。
// HowTo / FAQPage JSON-LD は本文の可視内容と 1:1 対応させること（リッチリザルト適格性）。

const TITLE = '通勤時間マップの使い方 — 通勤時間から引っ越し先を決める方法'
const DESCRIPTION =
  '通勤時間マップは、通勤先までの所要時間で地図上の駅を色分けするツールです。Kayoha の使い方 5 ステップと、通勤時間から逆算して引っ越し先を決める手順、よくある質問をまとめました。無料・登録不要。'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/guide' },
  openGraph: {
    title: `${TITLE} | Kayoha`,
    description: DESCRIPTION,
    url: '/guide',
    type: 'article',
    siteName: 'Kayoha',
    locale: 'ja_JP',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: TITLE }],
  },
}

const HOWTO_STEPS = [
  {
    name: '通勤先の駅を選ぶ',
    text: '地図を開いたら、職場や学校の最寄り駅を通勤先として選びます。新宿・東京・渋谷などの主要 30 駅はワンタップ、それ以外の駅も検索して指定できます。',
  },
  {
    name: '色分けされた地図を読む',
    text: '東京圏の全 1831 駅が、通勤先までの所要時間で色分けされます。色は実際の時刻表データから乗り換えを含めて算出した最短所要時間に対応しています。',
  },
  {
    name: 'スライダーで時間圏を絞り込む',
    text: '「30 分以内」「45 分以内」のように、許容できる通勤時間で表示を絞り込みます。自分の通勤圏が地図の形でひと目でわかります。',
  },
  {
    name: '乗換回数で条件を加える',
    text: '乗換なし・1 回までなど、乗換回数フィルタを重ねられます。所要時間は同じでも、乗換の少ない経路は毎日の負担が大きく違います。',
  },
  {
    name: '気になる駅をタップして比べる',
    text: '駅をタップすると、家賃相場・街の特徴・住民のコミュニティ評価が開きます。候補駅をお気に入りに入れて並べて比較できます。',
  },
]

const FAQ_ITEMS = [
  {
    q: '通勤時間マップとは何ですか？',
    a: '通勤先までの所要時間を、地図上のすべての駅に色で表示する地図ツールです。Kayoha は東京圏の 1831 駅に対応し、実際の時刻表データに基づく所要時間に、駅ごとの家賃相場・街の特徴・コミュニティ評価を重ねて表示します。',
  },
  {
    q: '利用は無料ですか？登録は必要ですか？',
    a: '無料で、会員登録も不要です。ブラウザで開くだけで使えます。スマートフォンでは「ホーム画面に追加」をするとアプリのように起動できます。',
  },
  {
    q: '所要時間はどうやって計算していますか？',
    a: '実際の鉄道時刻表データ（GTFS）に基づき、乗り換えを含めた最短経路の所要時間を駅ごとに算出しています。地図上の数値は固定のダイヤ実績に基づくため、検索のたびに変わることはありません。',
  },
  {
    q: '対応エリアはどこですか？',
    a: '東京圏を中心とした関東の鉄道駅 1831 駅に対応しています。東京都・神奈川県・埼玉県・千葉県のほか、茨城・栃木・群馬・山梨の駅も含みます。',
  },
  {
    q: '家賃相場のデータはどこから来ていますか？',
    a: '政府の住宅統計に基づく月額の目安を駅ごとに表示しています。一部の主要駅では間取り別の相場も確認できます。',
  },
  {
    q: '通勤先は複数設定できますか？',
    a: '2 つまで設定できます（二拠点通勤）。共働きで職場が別々の場合などに、両方へ通いやすいエリアを合成して表示します。',
  },
]

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (locale !== 'ja') notFound()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Kayoha 通勤時間マップの使い方',
      description: '通勤先を選ぶだけで東京圏 1831 駅が通勤時間で色分けされる、Kayoha の基本的な使い方。',
      totalTime: 'PT3M',
      step: HOWTO_STEPS.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kayoha', item: 'https://kayoha.com/' },
        { '@type': 'ListItem', position: 2, name: '通勤時間マップの使い方' },
      ],
    },
  ]

  return (
    <main className="overflow-y-auto h-[100dvh] w-screen bg-sp-bg" lang="ja">
      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <nav className="mb-8 text-xs text-ed-ink/50 font-shippori">
          <Link href="/" className="hover:text-ed-ink/80">Kayoha</Link>
          <span className="mx-2">›</span>
          <span>通勤時間マップの使い方</span>
        </nav>

        <header className="mb-10 md:mb-14">
          <p className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-3">
            How to Use
          </p>
          <h1 className="font-shippori text-3xl md:text-4xl font-medium text-ed-ink mb-5 leading-tight">
            通勤時間マップの使い方
            <span className="block mt-2 text-lg md:text-xl text-ed-ink/60">通勤時間から引っ越し先を決める方法</span>
          </h1>
          <p className="font-shippori text-base md:text-lg leading-loose text-ed-ink/85">
            通勤時間マップとは、通勤先までの所要時間を地図上のすべての駅に色で表示するツールです。「家賃で探して、あとから通勤がつらいと気づく」順番を逆転させて、まず通える範囲を地図で確かめてから街を選べます。Kayoha は東京圏の 1831 駅すべてを実際の時刻表データで色分けし、家賃相場と街の特徴まで同じ画面で比較できる無料の通勤時間マップです。
          </p>
        </header>

        {/* 使い方 5 ステップ（HowTo JSON-LD と 1:1） */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            基本の使い方 — 5 ステップ
          </h2>
          <ol className="space-y-6">
            {HOWTO_STEPS.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-cormorant text-2xl text-ed-accent/80 tabular-nums leading-none pt-1">{i + 1}</span>
                <div>
                  <h3 className="font-shippori text-base font-medium text-ed-ink mb-1">{s.name}</h3>
                  <p className="font-shippori text-sm leading-relaxed text-ed-ink/75">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 引っ越し先の決め方 */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            通勤時間から引っ越し先を決める手順
          </h2>
          <div className="font-shippori text-sm md:text-base leading-loose text-ed-ink/85 space-y-5">
            <p>
              <strong className="font-medium">① 許容できる通勤時間を先に決める。</strong>
              理想は人それぞれですが、毎日往復することを考えると「ドアからドアで 60 分」あたりが多くの人の上限です。地図のスライダーをその時間に合わせれば、候補になり得る駅だけが残ります。
            </p>
            <p>
              <strong className="font-medium">② 残った駅を家賃相場と照らし合わせる。</strong>
              同じ 30 分圏でも、方面によって家賃相場は大きく違います。駅をタップして相場を見比べるか、
              <Link href="/to" className="underline decoration-ed-ink/30 hover:text-ed-accent">通勤先別ガイド</Link>
              で「30 分圏の駅一覧と平均家賃」をまとめて確認できます。
            </p>
            <p>
              <strong className="font-medium">③ 街の性格で絞り込む。</strong>
              商店街のにぎわい、夜の静かさ、子育て環境 — 数字に出ない条件は駅ごとの「街の特徴」と住民評価で確かめます。
              <Link href="/area" className="underline decoration-ed-ink/30 hover:text-ed-accent">区市別の駅データ一覧</Link>
              から各駅の詳細ガイドへ進めます。
            </p>
            <p>
              <strong className="font-medium">④ 候補を 2〜3 駅まで絞って現地へ。</strong>
              最後は実際に歩くのがいちばんです。お気に入りに入れた候補駅を平日の夜と週末の昼に訪ねると、地図ではわからない空気がつかめます。
            </p>
          </div>
        </section>

        {/* こんな使い方も */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            こんな使い方も
          </h2>
          <ul className="font-shippori text-sm md:text-base leading-loose text-ed-ink/85 space-y-3 list-disc pl-5">
            <li><strong className="font-medium">共働きの二拠点通勤</strong> — 通勤先を 2 つ設定すると、両方に通いやすいエリアを合成表示。職場が離れている夫婦の住まい探しに。</li>
            <li><strong className="font-medium">通学圏の確認</strong> — 大学・専門学校を通勤先にすれば、通学時間ベースの部屋探しにそのまま使えます。</li>
            <li><strong className="font-medium">AI に相談する</strong> — 希望条件（予算・雰囲気・通勤時間）を伝えると、AI が候補駅を理由つきで提案します。</li>
          </ul>
        </section>

        {/* FAQ（FAQPage JSON-LD と 1:1） */}
        <section className="mb-14 md:mb-20">
          <h2 className="font-cormorant text-sm uppercase tracking-[0.3em] text-ed-ink/60 mb-6 text-center">
            よくある質問
          </h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((f, i) => (
              <div key={i}>
                <dt className="font-shippori text-base font-medium text-ed-ink mb-1.5">{f.q}</dt>
                <dd className="font-shippori text-sm leading-relaxed text-ed-ink/75">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mb-14 text-center">
          <Link
            href="/"
            className="inline-block font-shippori text-base font-medium text-white bg-ed-accent rounded-full px-8 py-4 shadow-md hover:opacity-90 transition-opacity"
          >
            通勤時間マップを開く →
          </Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-ed-ink/10 text-center text-xs text-ed-ink/50 space-x-4">
          <Link href="/" className="hover:text-ed-ink/80 transition-colors">Top</Link>
          <Link href="/to" className="hover:text-ed-ink/80 transition-colors">通勤先ガイド</Link>
          <Link href="/area" className="hover:text-ed-ink/80 transition-colors">エリア一覧</Link>
          <Link href="/legal" className="hover:text-ed-ink/80 transition-colors">運営情報</Link>
        </footer>
      </article>
    </main>
  )
}
