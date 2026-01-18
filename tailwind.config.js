/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#061226",
          card: "#0b1020",
          primary: "#2563eb",
          accent: "#22c55e"
        }
      }
    }
  },
  plugins: []
};
