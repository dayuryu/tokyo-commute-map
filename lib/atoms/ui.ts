/**
 * 叶子 UI 状態の atom 層。不変量・時序・永続化を持たない単純な値。
 *
 * ADR-0003（Jotai 全面移行）の P1 で page.tsx の useState から切り出した最初の atom 群。
 * 消費側 component は useAtom / useAtomValue で直接購読し、props drilling を解消する。
 */
import { atom } from 'jotai'
import type { Station } from '@/lib/types'

/** 等時圏フィルタの上限（分）。TimeSlider が更新、Legend / MapView が消費。
 *  初値 45 は旧 page.tsx useState から踏襲。 */
export const maxMinutesAtom = atom(45)

/** 乗換回数フィルタ。99 = 制限なし、0 = 直通のみ、1 = 1 回まで。
 *  TransferFilter が更新、MapView が消費。初値 99 は旧 page.tsx useState から踏襲。 */
export const maxTransfersAtom = atom(99)

/** 現在 drawer を開いている駅（INK 黒ピン表示対象）。null = drawer 閉。
 *  MapView がクリックで set / 黒ピン描画で読み、StationDrawer が表示 + close で null に、
 *  CookieConsent が「drawer が開いているか」の判定で読む。 */
export const selectedStationAtom = atom<Station | null>(null)
