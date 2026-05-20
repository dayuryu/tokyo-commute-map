import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware navigation primitives。素の `next/link` だと href="/" は middleware の
 * cookie 優先で `/zh` に再リダイレクトされてしまい、現在ロケールから抜けられない。
 * `next-intl/navigation` 経由の Link は `locale` prop で NEXT_LOCALE cookie を同時に
 * 書き換えるため、切替が確実に効く。
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
