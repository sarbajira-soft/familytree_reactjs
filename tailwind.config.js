/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          // You can name this anything, 'primary' is common
            DEFAULT: "#1976D2", // Your primary
            50: "#E3F2FD",
            100: "#BBDEFB",
            200: "#90CAF9",
            300: "#64B5F6",
            400: "#42A5F5",
            500: "#2196F3",
            600: "#1E88E5",
            700: "#1976D2", // Your shade
            800: "#1565C0", // Your hover shade
            900: "#0D47A1",
          
        },
        secondary: {
          DEFAULT: "#f97316", // Main orange
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },

        // You can keep other colors or define more here (e.g., 'secondary', 'accent')
      },
    },
  },
  plugins: [],
};
