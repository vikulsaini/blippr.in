export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#08090d',
        panel: '#11131a',
        line: 'rgba(255, 255, 255, 0.08)',
        mint: '#3dd6c6',
        coral: '#ff6b7d',
        gold: '#f0bd48',
        violet: '#9b8cff',
        sky: '#62a8ff',
        rose: '#ff8aa8'
      },
      boxShadow: {
        glow: '0 18px 46px rgba(0, 0, 0, 0.26)',
        lift: '0 18px 44px rgba(7, 10, 18, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
      }
    }
  },
  plugins: []
};
