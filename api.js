const fs = require('fs');
const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

let apiKeys = [];
try {
  const data = fs.readFileSync('api.json', 'utf8');
  apiKeys = JSON.parse(data);
} catch (err) {
  if (err.code !== 'ENOENT') {
    throw new Error(`Error reading api.json: ${err.message}`);
  }
}

const newApiKey = generateApiKey();
apiKeys.push(newApiKey);

fs.writeFileSync('api.json', JSON.stringify(apiKeys, null, 2));

console.log('Your API key for Nimbus:', newApiKey);
