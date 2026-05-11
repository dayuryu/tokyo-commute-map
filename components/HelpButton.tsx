'use client'

interface Props {
  onClick: () => void
}

export default function HelpButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="はじめに戻る"
      aria-label="はじめに戻る"
      className="absolute bottom-4 left-4 z-10
                 w-11 h-11 rounded-full
                 flex items-center justify-center
                 transition-all duration-200
                 hover:scale-110 active:scale-95"
      style={{
        background: 'var(--ink)',
        color: '#f5e7d2',
        border: '.5px solid rgba(245,231,210,.20)',
        boxShadow: '0 1px 2px rgba(0,0,0,.10), 0 6px 20px rgba(0,0,0,.18)',
        fontFamily: 'var(--display-italic, "Cormorant Garamond", Garamond, serif)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: 22,
        letterSpacing: '.02em',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#a8332b'
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,.12), 0 10px 28px rgba(168,51,43,.30)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--ink)'
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.10), 0 6px 20px rgba(0,0,0,.18)'
      }}
    >
      ?
    </button>
  )
}
