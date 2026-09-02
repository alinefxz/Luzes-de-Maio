const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

assert.doesNotMatch(source, /ADMIN_PASSWORD\s*=/, 'A senha administrativa nao pode existir no JavaScript publico.');
assert.doesNotMatch(source, /password:\s*['"]admin['"]/, 'A credencial administrativa nao pode ser enviada ao navegador.');
assert.match(source, /loginRemote\(loginUsername, loginPassword\)/, 'O login deve continuar validado pela API remota.');

console.log('Credenciais administrativas removidas do pacote publico.');
