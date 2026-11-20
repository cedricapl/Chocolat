import { build } from 'esbuild';
import fs from 'node:fs';

const font = (pkg, file) => fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64');
const faces = `
@font-face{font-family:'Cormorant Garamond';font-weight:300;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${font('cormorant-garamond', 'cormorant-garamond-latin-300-normal.woff2')}) format('woff2')}
@font-face{font-family:'Cormorant Garamond';font-weight:400;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${font('cormorant-garamond', 'cormorant-garamond-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'Italiana';font-weight:400;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${font('italiana', 'italiana-latin-400-normal.woff2')}) format('woff2')}
`;

const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', loader: { '.glb': 'base64' } });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const body = fs.readFileSync('src/body.html', 'utf8');
fs.mkdirSync('dist', { recursive: true });

const frag = `<title>Nour Chocolatier</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${faces}${css}</style>
${body}
<script>${js}</script>
`;
fs.writeFileSync('dist/artifact.html', frag);
fs.writeFileSync('dist/index.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Nour Chocolatier</title><style>body{margin:0}</style>
<style>${faces}${css}</style></head><body>
${body}
<script>${js}</script></body></html>
`);
console.log('ok', (frag.length / 1024).toFixed(0) + ' KB');
