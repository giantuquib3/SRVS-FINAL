/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // USJ-R green — primary brand color (#005A36 = brand-700)
        brand: {
          50: "#eef7f2",
          100: "#d5ece0",
          200: "#aad8c1",
          300: "#74bd9a",
          400: "#3f9d72",
          500: "#1b8152",
          600: "#0a6c43",
          700: "#005a36",
          800: "#004a2d",
          900: "#003a23",
          DEFAULT: "#005a36",
        },
        // USJ-R gold — accent color (#C99700 = accent-500)
        accent: {
          50: "#fdf8e8",
          100: "#faeec4",
          200: "#f5dc87",
          300: "#efc84a",
          400: "#e2b11c",
          500: "#c99700",
          600: "#a57b00",
          700: "#7f5f00",
          DEFAULT: "#c99700",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
