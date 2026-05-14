// 運営者情報・サイト情報の facade。
// 環境変数が無い場合は安全な fallback を返す。
// 後で affiliate 関連設定（ASP リスト等）もここに集約する。

export interface SiteInfo {
  siteName: string
  siteNameJa: string
  siteUrl: string
  operatorName: string
  operatorAddress: string
  operatorPhone: string
  contactEmail: string
  // ステマ規制対応：このサイトが利用している ASP のリスト
  affiliatePartners: { name: string; operator: string }[]
}

export function getSiteInfo(): SiteInfo {
  return {
    siteName: 'Kayoha',
    siteNameJa: '通葉',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kayoha.com',
    operatorName: process.env.OWNER_NAME ?? '【記載準備中】',
    operatorAddress: process.env.OWNER_ADDRESS ?? '請求があった場合は遅滞なく開示します',
    operatorPhone: process.env.OWNER_PHONE ?? '請求があった場合は遅滞なく開示します',
    contactEmail: process.env.CONTACT_EMAIL ?? 'contact@example.com',
    affiliatePartners: [
      { name: 'A8.net',         operator: '株式会社ファンコミュニケーションズ' },
      { name: 'バリューコマース', operator: 'バリューコマース株式会社' },
      { name: 'もしもアフィリエイト', operator: '株式会社もしも' },
    ],
  }
}

export const LAST_UPDATED = '2026-05-14'
