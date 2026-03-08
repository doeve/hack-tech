/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        aviation: '#1C4587',     
        coolWhite: '#F4F7F9',
        successMint: '#98FFD9',  
        anthracite: '#333333',    
        goldAccent: '#D4AF37',   
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], 
      }
    },
  },
  plugins: [],
}