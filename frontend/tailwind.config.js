// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:   '#5F9686', // 헤더·버튼
        secondary: '#8358AA', // 강조색
        accent:    '#F5B55B', // 알림·뱃지
        bg:        '#F9FAFB', // 페이지 배경
        surface:   '#FFFFFF', // 카드·테이블 배경
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
};
