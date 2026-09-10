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
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" }
        },
        "modal-pop": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "modal-pop": "modal-pop 0.15s ease-out"
      },
    },
  },
  plugins: [],
};
