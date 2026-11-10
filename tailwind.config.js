/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        tremor: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(0.6px, -0.6px)" },
          "50%": { transform: "translate(-0.6px, 0.4px)" },
          "75%": { transform: "translate(0.4px, 0.6px)" },
        },
      },
      animation: {
        tremor: "tremor 0.4s linear infinite",
      },
    },
  },
  plugins: [],
};
