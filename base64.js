const fs = require('fs');

const key = fs.readFileSync('./assi11-knowledge-sharing-firebase-adminsdk-fbsvc-31957c3961.json', 'utf8');
const base64Key = Buffer.from(key).toString('base64');
console.log(base64Key);