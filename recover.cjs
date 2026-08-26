const fs = require('fs');
const text = fs.readFileSync('index.html', 'utf8');
let recovered = '';
for (let i = 1; i < text.length; i += 2) {
    recovered += text[i];
}
fs.writeFileSync('index.html', recovered, 'utf8');
console.log('Recovered!');
