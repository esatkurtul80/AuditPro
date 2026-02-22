const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Downgrade modern CSS color functions (oklch, oklab, color-mix) to sRGB
    // so that html2canvas (bundled in html2pdf.js) can parse them without errors.
    "@csstools/postcss-oklab-function": { preserve: false },
    "@csstools/postcss-color-mix-function": { preserve: false },
  },
};

export default config;
