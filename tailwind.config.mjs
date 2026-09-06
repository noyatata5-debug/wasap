/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        relief: {
          cream: '#f9f7f0',
          snow: '#ffffff',
          ink: '#333333',
          charcoal: '#212121',
          fog: '#d0d5dd',
          slate: '#616c8a',
          slateBorder: '#40444e',
          deepHarbor: '#13426f',
          skyPop: '#2e96ff',
          deepWave: '#0254a5',
          skyTint: '#bde1f9',
          skyWash: '#cde7fb',
          infoMist: '#73b9ff',
          skyMid: '#50a7ff',
        },
      },
      boxShadow: {
        'pop': 'rgba(154, 207, 246, 0.5) 0px 7px 0px 0px',
        'pop-sm': 'rgba(154, 207, 246, 0.5) 0px 5px 0px 0px',
        'card-relief': 'rgba(19, 66, 111, 0.06) 0px 8px 24px -4px, rgba(0, 0, 0, 0.04) 0px 2px 6px 0px',
        'card-flat': 'rgba(0, 0, 0, 0.05) 0px 3px 0px 0px',
      },
      borderRadius: {
        'pill': '9999px',
      },
      letterSpacing: {
        tightest: '-0.018em',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};

