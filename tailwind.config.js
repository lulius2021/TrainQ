/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "var(--bg)",
          card: "var(--surface)",
          primary: "var(--primary)",
          accent: "#22c55e"
        }
      }
    }
  },
  plugins: []
};
