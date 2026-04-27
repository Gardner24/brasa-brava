import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        sidebar: 'hsl(var(--sidebar))',
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          hover: 'hsl(var(--brand-hover))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Hex literales para uso en hero / branding (no se traducen a tema dark)
        charcoal: {
          DEFAULT: '#14100c',
          deep: '#0e0a06',
          light: '#1a1410',
        },
        ember: {
          DEFAULT: '#d4451f',
          dim: '#993c1d',
          light: '#f4a44b',
        },
        cream: {
          DEFAULT: '#fdf6e9',
          tortilla: '#f5e6d3',
        },
        wood: {
          DEFAULT: '#8a6d56',
          dark: '#5f4a3a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
