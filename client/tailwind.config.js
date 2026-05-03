export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07070a',
        panel: 'rgba(20, 21, 28, 0.72)',
        line: 'rgba(255, 255, 255, 0.12)',
        mint: '#5eead4',
        coral: '#fb7185',
        gold: '#facc15'
      },
      boxShadow: {
        glow: '0 18px 70px rgba(94, 234, 212, 0.16)'
      }
    }
  },
  plugins: []
};
