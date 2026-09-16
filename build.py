from pathlib import Path
root = Path(__file__).resolve().parent
html = (root / 'src/shell.html').read_text()
for name, source in [('CSS', 'style.css'), ('CORE', 'core.js'), ('RENDERER', 'renderer.js'), ('APP', 'app.js')]:
    html = html.replace('/* INLINE_' + name + ' */', (root / 'src' / source).read_text())
assert '/* INLINE_' not in html
(root / 'dist/index.html').write_text(html)
print(f'Built self-contained index.html: {len(html.encode()):,} bytes')
