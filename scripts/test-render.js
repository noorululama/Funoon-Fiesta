const http = require('http');

http.get('http://localhost:3001', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const hasEmptySrc = /src=["']\s*["']/.test(data);
    console.log('Has empty src attribute:', hasEmptySrc);
    console.log('Has Team Captains section:', data.includes('Team Captains'));
    console.log('Has Leaders:', data.includes('Leaders'));
    console.log('HTML length:', data.length);
  });
}).on('error', (err) => {
  console.error('Error fetching localhost:3001:', err);
});
