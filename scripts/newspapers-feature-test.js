const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const html = fs.readFileSync(path.join(publicDir, 'game.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'game.css'), 'utf8');
const homeCss = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');

const newspapers = [
  ['10-01-1932.pdf', '112', '10 de janeiro de 1932'],
  ['21-02-1932.pdf', '117', '21 de fevereiro de 1932'],
  ['09-08-1932.pdf', '138', '9 de agosto de 1932'],
  ['25-08-1932.pdf', '144', '25 de setembro de 1932'],
  ['09-10-1932.pdf', '146', '9 de outubro de 1932'],
  ['16-10-1932.pdf', '147', '16 de outubro de 1932'],
  ['06-11-1932.pdf', '150', '6 de novembro de 1932'],
  ['22-01-1933.pdf', '158', '22 de janeiro de 1933'],
  ['09-04-1933.pdf', '168', '9 de abril de 1933'],
  ['16-04-1933.pdf', '169', '16 de abril de 1933'],
  ['23-04-1933.pdf', '170', '23 de abril de 1933'],
  ['07-05-1933.pdf', '172', '7 de maio de 1933'],
  ['28-05-1933.pdf', '175', '28 de maio de 1933'],
];

assert.match(html, />Jornais<\/button>/, 'o menu deve usar apenas o nome Jornais');
assert.match(html, /id="modal-newspapers"/, 'o modal de jornais deve existir');
assert.match(html, /id="newspaperViewer"/, 'o leitor interno de PDF deve existir');
assert.match(indexHtml, />Jornais<\/button>/, 'o indice da pagina inicial deve incluir Jornais');
assert.match(indexHtml, /id="modal-newspapers"/, 'a pagina inicial deve conter o modal de jornais');
assert.match(indexHtml, /id="newspaperViewer"/, 'a pagina inicial deve conter o leitor de PDF');
assert.doesNotMatch(html, /data impressa no original/i, 'o jogo nao deve exibir a observacao sobre a data impressa');
assert.doesNotMatch(indexHtml, /data impressa no original/i, 'a pagina inicial nao deve exibir a observacao sobre a data impressa');
assert.match(homeCss, /\.newspaper-archive/, 'a pagina inicial deve carregar o visual da hemeroteca');
assert.match(html, /Sobre o Luzes de Maio/, 'o novo titulo do Sobre deve existir');
assert.match(html, /Todo arquivo guarda uma história/, 'o encerramento enviado deve ser preservado');
assert.match(html, /Aline Fernanda de Oliveira/, 'os creditos da pesquisa devem estar presentes');
assert.match(css, /\.newspaper-archive/, 'a hemeroteca deve possuir estilos dedicados');
assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.newspaper-archive/, 'a hemeroteca deve possuir tratamento para celular');

for (const [file, edition, date] of newspapers) {
  const relativeUrl = `assets/jornais/${file}`;
  assert.ok(html.includes(relativeUrl), `o indice deve apontar para ${file}`);
  assert.ok(html.includes(`Edição ${edition}`), `a edicao ${edition} deve ser informada`);
  assert.ok(html.includes(date), `a data ${date} deve ser informada`);

  const absolutePath = path.join(publicDir, 'assets', 'jornais', file);
  assert.ok(fs.existsSync(absolutePath), `${file} deve ser publicado`);
  const signature = fs.readFileSync(absolutePath).subarray(0, 5).toString('ascii');
  assert.equal(signature, '%PDF-', `${file} deve continuar sendo um PDF original`);
}

assert.equal(
  (html.match(/class="newspaper-record"/g) || []).length,
  newspapers.length,
  'o indice deve exibir exatamente as 13 edicoes recebidas'
);

console.log('Hemeroteca e Sobre validados com 13 PDFs originais.');
