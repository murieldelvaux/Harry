const axios = require('axios');

const API_KEY = 'GCDC_dd2e03c8-d2ca-4012-b7ad-d907dd776ece.bb56d84c-9e9e-4bb3-baaf-6b83eb9b56cc.nv7yM40SYgb5+GUWbmHxG/lK4ff0hBaGOSuE3VjxYU0.3988175130';
const BASE_URL = 'https://personal.connectapi.garmin.com';

async function main() {
  const tokenResp = await axios.post(
    `${BASE_URL}/personalapitoken-service/personal-api/personal-api-key/token`,
    null,
    {
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
        Accept: 'text/plain, application/json',
      },
    }
  );
  const jwt = typeof tokenResp.data === 'string' ? tokenResp.data.trim() : tokenResp.data?.token;
  
  // Decode JWT payload
  const parts = jwt.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    console.log('JWT Payload:', JSON.stringify(payload, null, 2));
  }

  // Buscar mais atividades para ver o que existe na conta
  const authHeaders = { Authorization: `Bearer ${jwt}` };
  const resp = await axios.get(`${BASE_URL}/activitylist-service/activities/search/activities?start=0&limit=50`, {
    headers: authHeaders
  });
  console.log(`Total atividades retornadas: ${resp.data.length}`);
  const sampleSummary = resp.data.map(a => ({
    id: a.activityId,
    name: a.activityName,
    type: a.activityType?.typeKey,
    startTime: a.startTimeLocal,
    distanceKm: a.distance ? (a.distance / 1000).toFixed(2) : null,
    durationMin: a.duration ? (a.duration / 60).toFixed(1) : null
  }));
  console.log('Atividades recentes:', JSON.stringify(sampleSummary.slice(0, 15), null, 2));
}

main().catch(console.error);

