import type { Metadata } from 'next'
import { getSiteInfo, LAST_UPDATED } from '@/lib/site-info'

export const metadata: Metadata = {
  title: 'クレジット・出典 | Kayoha',
  description: 'Kayoha（通葉）が利用しているオープンデータ・オープンソースソフトウェア・各種サービスの提供元とライセンス情報。',
}

// 22 GTFS 提供事業者。表記は各社の正式社名（一般通称を括弧で補記）。
const GTFS_OPERATORS: { name: string; common?: string }[] = [
  { name: '東日本旅客鉄道',          common: 'JR 東日本' },
  { name: '東京地下鉄',              common: '東京メトロ' },
  { name: '東京都交通局',            common: '都営地下鉄' },
  { name: '東急電鉄' },
  { name: '小田急電鉄' },
  { name: '京王電鉄' },
  { name: '西武鉄道' },
  { name: '東武鉄道' },
  { name: '京浜急行電鉄',            common: '京急' },
  { name: '京成電鉄' },
  { name: '相模鉄道',                common: '相鉄' },
  { name: '横浜市交通局' },
  { name: '首都圏新都市鉄道',        common: 'つくばエクスプレス' },
  { name: '北総鉄道' },
  { name: '横浜高速鉄道',            common: 'みなとみらい線' },
  { name: '東京臨海高速鉄道',        common: 'りんかい線' },
  { name: '埼玉高速鉄道' },
  { name: '東葉高速鉄道' },
  { name: '多摩都市モノレール' },
  { name: '東京モノレール' },
  { name: '新京成電鉄' },
  { name: 'ゆりかもめ' },
]

export default function CreditsPage() {
  const site = getSiteInfo()

  return (
    <article className="fade-up space-y-10">
      <header>
        <h1 className="font-display text-3xl md:text-4xl text-sp-ink mb-4">
          クレジット・出典
        </h1>
        <p className="text-sm leading-relaxed text-sp-ink-soft">
          {site.siteName}（{site.siteNameJa}）は、多くのオープンデータ・オープンソースソフトウェア・パブリックサービスに支えられています。本ページでは、本サイトが利用しているすべての主要な提供元とライセンスを記載します。
        </p>
      </header>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">1. 駅・路線データ</h2>
        <ul className="space-y-3">
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">station_database</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供:{' '}
              <a
                href="https://github.com/Seo-4d696b75/station_database"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >
                Seo-4d696b75 / station_database
              </a>
            </div>
            <div className="text-sm text-sp-ink-soft mt-1">
              ライセンス: <span className="font-mono-num">CC BY 4.0</span>
            </div>
            <div className="text-sm text-sp-txt mt-2 leading-relaxed">
              本サイトに掲載されている 1843 駅の座標・路線属性・乗換情報。
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">2. 運行ダイヤ（GTFS）</h2>
        <ul className="space-y-3">
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">TrainGTFSGenerator</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供:{' '}
              <a
                href="https://github.com/fksms/TrainGTFSGenerator"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >
                fksms / TrainGTFSGenerator
              </a>
              {' '}（Release 20241214）
            </div>
            <div className="text-sm text-sp-txt mt-2 leading-relaxed">
              各鉄道事業者が公式に公開している運行データ（GTFS 形式）を基に、関東圏 22 社分のダイヤを統合した二次データセット。本サイトの通勤時間推算（Dijkstra 法）のグラフ重みに使用しています。
            </div>
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-sp-txt mt-4 mb-3">
          上記 GTFS データの元情報を提供している鉄道事業者（22 社）:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-sp-txt">
          {GTFS_OPERATORS.map(op => (
            <li key={op.name} className="leading-relaxed">
              · {op.name}
              {op.common && (
                <span className="text-sp-ink-soft"> ({op.common})</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-sp-ink-soft mt-4 leading-relaxed">
          各社のダイヤ・運賃・最新情報は公式案内をご確認ください。本サイトは推算値であり、実際の所要時間とは ±5〜10 分程度の誤差が生じる場合があります。
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">3. 家賃相場データ</h2>
        <ul className="space-y-3">
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">住宅・土地統計調査</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供: 総務省統計局（<a
                href="https://www.e-stat.go.jp/"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >e-Stat</a>）
            </div>
            <div className="text-sm text-sp-txt mt-2 leading-relaxed">
              全 1940 駅圏の家賃 baseline。公開統計データを基に駅圏に按分しています。
            </div>
          </li>
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">SUUMO 駅別家賃相場</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供: 株式会社リクルート
            </div>
            <div className="text-sm text-sp-txt mt-2 leading-relaxed">
              主要 101 駅の家賃目安として参照。最新の物件情報は{' '}
              <a
                href="https://suumo.jp/"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >SUUMO 公式サイト</a>
              {' '}でご確認ください。
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">4. 地図描画</h2>
        <ul className="space-y-3">
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">MapLibre GL JS</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供:{' '}
              <a
                href="https://maplibre.org/"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >MapLibre 開発者コミュニティ</a>
            </div>
            <div className="text-sm text-sp-ink-soft mt-1">
              ライセンス: <span className="font-mono-num">BSD 3-Clause</span>
            </div>
          </li>
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">OpenFreeMap</div>
            <div className="text-sm text-sp-ink-soft mt-1">
              提供:{' '}
              <a
                href="https://openfreemap.org/"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >OpenFreeMap</a>
              {' '}（Liberty スタイル）
            </div>
            <div className="text-sm text-sp-txt mt-2 leading-relaxed">
              ベクトルタイル底図は OpenStreetMap 寄稿者によるデータを基に配信されています。
              © <a
                href="https://www.openstreetmap.org/copyright"
                className="underline hover:text-sp-ink"
                target="_blank"
                rel="noopener noreferrer"
              >OpenStreetMap contributors</a>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">5. フォント</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-3">
          すべて Google Fonts 経由で配信されており、いずれも <span className="font-mono-num">SIL Open Font License 1.1</span> に基づいて利用しています。
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">Shippori Mincho</div>
            <div className="text-sp-ink-soft mt-1">Fontworks Inc.</div>
          </li>
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">Cormorant Garamond</div>
            <div className="text-sp-ink-soft mt-1">Christian Thalmann</div>
          </li>
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">Inter</div>
            <div className="text-sp-ink-soft mt-1">Rasmus Andersson</div>
          </li>
          <li className="border border-sp-ink-soft/15 rounded-lg px-4 py-3">
            <div className="font-semibold text-sp-ink">JetBrains Mono</div>
            <div className="text-sp-ink-soft mt-1">JetBrains</div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">6. インフラ・サービス</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-sp-txt">
          <li>
            <span className="font-semibold text-sp-ink">ホスティング:</span>{' '}
            <a
              href="https://vercel.com/"
              className="underline hover:text-sp-ink"
              target="_blank"
              rel="noopener noreferrer"
            >Vercel</a>
          </li>
          <li>
            <span className="font-semibold text-sp-ink">データベース:</span>{' '}
            <a
              href="https://supabase.com/"
              className="underline hover:text-sp-ink"
              target="_blank"
              rel="noopener noreferrer"
            >Supabase</a>
            （ユーザー評価・通勤時間訂正・AI 推薦キャッシュ）
          </li>
          <li>
            <span className="font-semibold text-sp-ink">AI 推薦エンジン:</span>{' '}
            <a
              href="https://openai.com/"
              className="underline hover:text-sp-ink"
              target="_blank"
              rel="noopener noreferrer"
            >OpenAI</a>
            （駅推薦ウィザードの結果生成）
          </li>
          <li>
            <span className="font-semibold text-sp-ink">DNS・メール転送:</span>{' '}
            <a
              href="https://www.cloudflare.com/"
              className="underline hover:text-sp-ink"
              target="_blank"
              rel="noopener noreferrer"
            >Cloudflare</a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">7. アフィリエイトプログラム</h2>
        <p className="text-sm leading-relaxed text-sp-txt mb-3">
          本サイトは、以下のアフィリエイトサービスプロバイダを通じて広告収益を得ています。広告表示の詳細は{' '}
          <a href="/legal/ads" className="underline hover:text-sp-ink">広告表示について</a>
          {' '}をご確認ください。
        </p>
        <ul className="space-y-2">
          {site.affiliatePartners.map(p => (
            <li
              key={p.name}
              className="border border-sp-ink-soft/15 rounded-lg px-4 py-3 text-sm"
            >
              <div className="font-semibold text-sp-ink">{p.name}</div>
              <div className="text-sp-ink-soft">運営: {p.operator}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-sp-ink mb-3">8. 謝辞</h2>
        <p className="text-sm leading-relaxed text-sp-txt">
          上記すべての提供元・開発者・寄稿者・運営事業者の皆さまへ深く感謝申し上げます。オープンデータとオープンソースの蓄積なくして、本サイトは存在しません。
        </p>
        <p className="text-sm leading-relaxed text-sp-txt mt-3">
          記載に漏れ・誤りがある場合は{' '}
          <a href="/legal/contact" className="underline hover:text-sp-ink">お問い合わせ</a>
          {' '}よりご指摘ください。
        </p>
      </section>

      <p className="text-xs text-sp-ink-soft/80 pt-6 border-t border-sp-ink-soft/15">
        最終更新日: {LAST_UPDATED}
      </p>
    </article>
  )
}
