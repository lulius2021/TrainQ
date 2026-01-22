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
          primary: "#007AFF", // Apple Blue
          accent: "#007AFF"
        }
      },
      backgroundColor: {
        surface: "var(--surface)",
        surface2: "var(--surface2)",
      },
      borderColor: {
        surface: "var(--border)",
      },
      backdropBlur: {
        xl: "24px",
      },
      borderWidth: {
        DEFAULT: "1px",
        '1.5': "1.5px",
      }
    }
  },
  plugins: []
};
