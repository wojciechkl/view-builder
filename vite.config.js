import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// The library build has no HTML entry, so `vite preview` would serve an empty
// dist folder. This plugin emits a demo page (index.html -> ./view-builder.js)
// into dist so the bundle can be inspected with `npm run preview`.
function demoPage() {
  const inline = `
  <script src="./view-builder.js"></script>
  <script>
    (function () {
      var xmlOut = document.getElementById('liveXml');
      var builder = window.ViewBuilder.mount('#builder', {
        onChange: function () {
          xmlOut.value = builder.getXml();
        },
      });
      xmlOut.value = builder.getXml();
      document.getElementById('toggleHostile').addEventListener('click', function () {
        document.body.classList.toggle('hostile');
      });
      var language = document.getElementById('language');
      if (language) {
        language.addEventListener('change', function () {
          var code = language.value;
          if (window.ViewBuilder.languages().indexOf(code) >= 0) {
            builder.setLanguage(code);
            return;
          }
          var script = document.createElement('script');
          script.src = './lang/' + code + '.js';
          script.onload = function () { builder.setLanguage(code); };
          document.head.appendChild(script);
        });
      }
    })();
  </script>`;
  return {
    name: 'view-builder-demo-page',
    apply: 'build',
    generateBundle() {
      const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
        .replace(/\s*<script type="module" src="\/src\/main\.js"><\/script>/, inline);
      this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
    },
  };
}

// Translations are plain ES modules in src/lib/lang; this plugin emits each one
// as a standalone dist/lang/<code>.js script that registers itself with the
// ViewBuilder global (or queues itself if it loads before the bundle).
function languageFiles() {
  const codes = ['en', 'pl'];
  const wrap = (code, pack) => [
    '/* ViewBuilder language pack: ' + code + ' */',
    '(function (g) {',
    '  var pack = ' + JSON.stringify(pack, null, 2) + ';',
    '  if (g.ViewBuilder && g.ViewBuilder.addLanguage) {',
    '    g.ViewBuilder.addLanguage(' + JSON.stringify(code) + ', pack);',
    '  } else {',
    '    (g.__viewBuilderLanguages = g.__viewBuilderLanguages || []).push([' + JSON.stringify(code) + ', pack]);',
    '  }',
    '})(typeof window !== "undefined" ? window : this);',
    '',
  ].join('\n');
  return {
    name: 'view-builder-language-files',
    apply: 'build',
    async generateBundle() {
      for (const code of codes) {
        const mod = await import('./src/lib/lang/' + code + '.js');
        this.emitFile({ type: 'asset', fileName: 'lang/' + code + '.js', source: wrap(code, mod.default) });
      }
    },
  };
}

// Library build: single dependency-free IIFE file that exposes window.ViewBuilder.
// The CSS is imported with ?inline and injected into the component shadow root,
// so no separate stylesheet has to be deployed to the XPages app.
export default defineConfig({
  plugins: [demoPage(), languageFiles()],
  build: {
    target: 'es2018',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/lib/index.js',
      name: 'ViewBuilder',
      formats: ['iife'],
      fileName: () => 'view-builder.js',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
});
