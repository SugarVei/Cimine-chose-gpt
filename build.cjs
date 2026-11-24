const fs = require('node:fs')
const path = require('node:path')
const esbuild = require('esbuild')

process.chdir(__dirname)
const result = esbuild.buildSync({
  entryPoints: ['src/main.js'], bundle: true, write: false,
  format: 'iife', target: ['es2020'], minify: true, legalComments: 'inline'
})
const css = ['app.css', 'seats.css'].map(name => fs.readFileSync(path.join('src', name), 'utf8')).join('\n')
const licensePath = path.join(path.dirname(require.resolve('three')), '../LICENSE')
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const template = fs.readFileSync('src/page.html', 'utf8')
fs.writeFileSync('index.html', template.replace('<!-- STYLES -->', () => '<style>' + css + '</style>')
  .replace('<!-- APP -->', () => '<script>/*\n' + fs.readFileSync(licensePath, 'utf8') + '\n*/\n' + script + '</script>'))
