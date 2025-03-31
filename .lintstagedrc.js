export default {
  // Run ESLint and Prettier on JS, JSX, TS, and TSX files
  "**/*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  // Run Prettier on JSON, MD, CSS, and SCSS files
  "**/*.{json,md,css,scss}": ["prettier --write"],
};
