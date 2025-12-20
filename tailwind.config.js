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
          bg: "#050816",
          card: "#0b1020",
          primary: "#2563eb",
          accent: "#22c55e"
        }
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    }
  },
  plugins: []
};
