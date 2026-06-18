export default {
  darkMode: ['class', '.dark-theme'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          tint: 'var(--accent-tint)',
          light: 'var(--accent-light)',
          ring: 'var(--accent-ring)',
          glow: 'var(--accent-glow)'
        },
        primary: 'var(--accent)',
        'primary-soft': 'var(--accent-hover)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        'surface-glass': 'var(--surface-glass)',
        'border-default': 'var(--border)',
        'border-hover': 'var(--border-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        coral: '#EF4444',
        gold: '#F59E0B',
        mint: '#10B981'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        float: 'var(--shadow-float)',
        elevated: 'var(--shadow-elevated)',
        glow: 'var(--shadow-glow)',
        'accent-sm': '0 2px 8px var(--accent-glow)',
        'accent-md': '0 4px 18px var(--accent-glow)',
        /* Brutal aliases → clean shadows */
        'brutal-sm': 'var(--shadow-card)',
        'brutal-md': 'var(--shadow-card-hover)',
        'brutal-lg': 'var(--shadow-float)',
        'brutal-xl': 'var(--shadow-elevated)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px'
      },
      animation: {
        'fade-slide-up': 'fadeSlideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'badge-pulse': 'badgePulse 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 6s ease infinite',
        'float': 'floatGlow 3s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'fadeIn': 'fadeSlideUp 0.25s ease forwards'
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        badgePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--accent-glow)' },
          '50%': { boxShadow: '0 0 0 6px transparent' }
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        },
        floatGlow: {
          '0%, 100%': { transform: 'translateY(0)', boxShadow: '0 4px 16px var(--accent-glow)' },
          '50%': { transform: 'translateY(-6px)', boxShadow: '0 8px 28px var(--accent-glow)' }
        },
        breathe: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' }
        }
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    }
  },
  plugins: []
};
