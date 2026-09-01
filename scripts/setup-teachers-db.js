const https = require('https');
require('dotenv').config();
const token = process.env.SUPABASE_TOKEN;
const projectRef = 'qmyrxvtbzlbnvzxypnus';

const sql = `
UPDATE teachers SET email = 'gauravroy476@gmail.com' WHERE name = 'Gaurav';
`;

const postData = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
