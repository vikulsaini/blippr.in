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
        gold: '#eab308'
      },
      boxShadow: {
        glow: '0 18px 46px rgba(0, 0, 0, 0.26)'
      }
    }
  },
  plugins: []
};
