/**
 * Tailwind (Play CDN) theme — design tokens from "Civic Events — Foundations".
 * Loaded right after https://cdn.tailwindcss.com on every page.
 */
/* global tailwind */
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      colors: {
        brand: { DEFAULT: '#1D4ED8', hover: '#1E3A8A', soft: '#DBEAFE' },
        accent: { DEFAULT: '#F59E0B', soft: '#FEF3C7', text: '#92400E' },
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        subtle: '#F1F5F9',
        inverse: '#0F172A',
        line: { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
        ink: { DEFAULT: '#0F172A', secondary: '#475569', muted: '#64748B', inverse: '#FFFFFF' },
        success: { DEFAULT: '#15803D', soft: '#DCFCE7' },
        danger: { DEFAULT: '#B91C1C', soft: '#FEE2E2' },
        warning: { DEFAULT: '#B45309', soft: '#FEF3C7' },
        info: { DEFAULT: '#0369A1', soft: '#E0F2FE' }
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        overline: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '700' }]
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
        pop: '0 12px 32px -12px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.06)'
      },
      maxWidth: { content: '72rem' }
    }
  }
};
