/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E11D74',
          hover: '#C2185B',
          soft: 'var(--color-brand-soft)',
          light: '#FCE7F3',
          dark: '#9D174D',
        },
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        divider: 'var(--color-divider)',
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
        },
        category: {
          tools: '#FEF9C3',
          tech: '#EDE9FE',
          outdoor: '#DCFCE7',
          home: '#CCFBF1',
          fits: '#FCE7F3',
          books: '#E0E7FF',
          sports: '#FFEDD5',
          other: '#F3E8FF',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        'pink': '0 4px 14px 0 rgba(225, 29, 116, 0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
