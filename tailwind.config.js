// tailwind.config.js

// Use 'require' para importar o plugin
const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Caminho para os seus arquivos
    "./src/**/*.{js,jsx,ts,tsx}",
    // Caminho GARANTIDO para a HeroUI
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    // Adicione o plugin da heroui aqui
    heroui(),
  ],
};