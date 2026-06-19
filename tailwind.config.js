/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        "open-sans": ["Open Sans", "sans-serif"],
        "nunito": ["Nunito", "sans-serif"]
      },
      colors: {
        "blue-meraki": "#4674EA",
        "peach-meraki": "#FCEDED",
        "pink-meraki": "#F2768C",
        "medium-turquoise-meraki": "#52C9BB"
      },
    },
  },
  plugins: [],
};
