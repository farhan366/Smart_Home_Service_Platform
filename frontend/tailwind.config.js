/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#101D2B",
        paper: "#F2F5F7",
        line: "#D6DEE5",
        lagoon: { DEFAULT: "#0B6E8A", dark: "#08566C", tint: "#E3F1F5" },
        marigold: { DEFAULT: "#F2B01E", tint: "#FDF3D9" },
        danger: "#B42318",
      },
    },
  },
  plugins: [],
};
