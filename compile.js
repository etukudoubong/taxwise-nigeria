const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');

const SRC = path.join(__dirname, 'index.html');
const DIST_DIR = path.join(__dirname, 'dist');

const html = fs.readFileSync(SRC, 'utf8');
const JSX_OPEN = '<script type="text/babel">';
const jsxStart = html.indexOf(JSX_OPEN);

fs.mkdirSync(DIST_DIR, { recursive: true });

if (jsxStart === -1) {
  fs.copyFileSync(SRC, path.join(DIST_DIR, 'index.html'));
  console.log('No JSX — copied as-is');
} else {
  const codeStart = jsxStart + JSX_OPEN.length;
  const jsxEnd = html.indexOf('</script>', codeStart);
  const jsxSource = html.slice(codeStart, jsxEnd);
  console.log(`Source: ${(jsxSource.length/1024).toFixed(1)}KB`);

  const compiled = transform(jsxSource, {transforms:['jsx']}).code;
  console.log(`Compiled: ${(compiled.length/1024).toFixed(1)}KB`);

  // Wrap entire app in a load handler so all CDN scripts are guaranteed ready
  // Use window.addEventListener('load') which fires after ALL scripts finish
  const wrappedJS = `
(function(){
  function startApp(){
    if(!window.React || !window.ReactDOM){
      setTimeout(startApp, 20);
      return;
    }
    var React = window.React;
    var ReactDOM = window.ReactDOM;
    // ── TaxWise Nigeria — compiled by Sucrase ──
${compiled}
  }
  if(document.readyState === 'complete'){
    startApp();
  } else {
    window.addEventListener('load', startApp);
  }
})();
`;

  // Build output HTML
  // 1. Remove Babel CDN
  // 2. Replace JSX script block with compiled wrapped JS
  let output = html;
  output = output.replace(
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n',
    ''
  );
  output = output.replace(
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
    ''
  );
  
  const beforeJSX = output.slice(0, output.indexOf(JSX_OPEN));
  const afterJSX = output.slice(output.indexOf(JSX_OPEN) + JSX_OPEN.length);
  const afterJSXCode = afterJSX.slice(afterJSX.indexOf('</script>') + 9);
  
  output = beforeJSX + '<script>' + wrappedJS + '</script>' + afterJSXCode;

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), output, 'utf8');
  console.log(`Output: dist/index.html (${(output.length/1024).toFixed(1)}KB)`);
}

// Copy all static files
const COPY_EXTS = ['.html','.json','.png','.ico','.svg','.webmanifest','.txt'];
const SKIP = new Set(['index.html','compile.js','package.json','package-lock.json']);
fs.readdirSync(__dirname).forEach(file => {
  if(SKIP.has(file) || file.startsWith('.') || file === 'dist' || file === 'node_modules') return;
  if(COPY_EXTS.includes(path.extname(file).toLowerCase())){
    fs.copyFileSync(path.join(__dirname, file), path.join(DIST_DIR, file));
    console.log(`Copied: ${file}`);
  }
});

// Copy icons folder if it exists
const iconsDir = path.join(__dirname, 'icons');
if(fs.existsSync(iconsDir)){
  const distIcons = path.join(DIST_DIR, 'icons');
  fs.mkdirSync(distIcons, {recursive:true});
  fs.readdirSync(iconsDir).forEach(f => {
    fs.copyFileSync(path.join(iconsDir,f), path.join(distIcons,f));
  });
  console.log('Copied: icons/');
}

fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');
console.log('Done.');
