export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#0D9488',
          hover: '#0F766E',
          tint: 'rgba(13, 148, 136, 0.05)',
          light: 'rgba(13, 148, 136, 0.10)',
          ring: 'rgba(13, 148, 136, 0.25)'
        },
        bg: '#F8F9FA',
        surface: '#FFFFFF',
        'surface-hover': '#F1F5F9',
        'border-default': '#E2E8F0',
        'border-hover': '#CBD5E1',
        'text-primary': '#1E293B',
        'text-secondary': '#334155',
        'text-muted': '#64748B',
        'text-faint': '#94A3B8',
        danger: '#EF4444',
        success: '#10B981',
        coral: '#EF4444',
        gold: '#F59E0B',
        mint: '#0D9488'
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)',
        float: '0 8px 28px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        elevated: '0 12px 40px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05)',
        glow: '0 0 0 1px rgba(13, 148, 136, 0.25), 0 4px 16px rgba(13, 148, 136, 0.12)',
        'accent-sm': '0 2px 8px rgba(13, 148, 136, 0.2)',
        'accent-md': '0 4px 14px rgba(13, 148, 136, 0.25)'
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px'
      }
    }
  },
  plugins: []
};
