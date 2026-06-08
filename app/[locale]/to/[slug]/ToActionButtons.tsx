'use client'
import { STORAGE_KEYS } from '@/lib/storage-keys'

interface Props {
  slug: string
  /** locale prefix 込みのトップページ URL（ja: '/'、zh: '/zh' 等）。 */
  homeHref: string
  /** server 側で locale 解決済みのボタン文言（client へ messages を持ち込まない）。 */
  labelMap: string
  labelAi: string
}

export default function ToActionButtons({ slug, homeHref, labelMap, labelAi }: Props) {
  function persistAndGo() {
    try {
      localStorage.setItem(STORAGE_KEYS.visited, '1')
      localStorage.setItem(
        STORAGE_KEYS.destination,
        JSON.stringify({ type: 'default', dest: slug }),
      )
    } catch {
      // localStorage 失効時は単純にトップへ遷移、地図側で再度通勤先を問う UX に戻る
    }
    window.location.href = homeHref
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={persistAndGo}
        className="w-full max-w-xs px-8 py-3.5 rounded-full
                   bg-ed-ink text-sp-bg font-shippori text-base
                   hover:bg-ed-ink/85 transition-colors
                   shadow-[0_2px_8px_rgba(0,0,0,.12)]"
      >
        {labelMap}
      </button>
      <button
        type="button"
        onClick={persistAndGo}
        className="w-full max-w-xs px-6 py-3 rounded-full
                   border border-ed-ink/30 text-ed-ink/85 font-shippori text-sm
                   hover:bg-ed-ink/5 hover:border-ed-ink/50 transition-colors"
      >
        {labelAi}
      </button>
    </div>
  )
}
