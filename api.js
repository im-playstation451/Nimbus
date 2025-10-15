const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

async function setupPulse() {
  return new Promise((resolve) => {
    rl.question('Do you want to setup the pulse CDN? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        console.log('Setting up CDN for pulse...');
        fs.mkdirSync('cdn/image', { recursive: true });
        fs.mkdirSync('cdn/profile', { recursive: true });
        fs.mkdirSync('cdn/others', { recursive: true });

        fs.writeFileSync('cdn/others/users.json', '[]');
        fs.writeFileSync('cdn/others/messages.json', '[]');
        console.log('Pulse CDN setup complete.');
      } else {
        console.log('Skipping Pulse CDN setup.');
      }
      rl.close();
      resolve();
    });
  });
}

async function main() {
  await setupPulse();

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
}

main();
