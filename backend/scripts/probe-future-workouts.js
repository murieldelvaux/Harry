const axios = require('axios');

const API_KEY = 'GCDC_dd2e03c8-d2ca-4012-b7ad-d907dd776ece.bb56d84c-9e9e-4bb3-baaf-6b83eb9b56cc.nv7yM40SYgb5+GUWbmHxG/lK4ff0hBaGOSuE3VjxYU0.3988175130';
const BASE_URL = 'https://personal.connectapi.garmin.com';

async function main() {
  console.log('1. Trocando API Key por Bearer Token...');
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
  console.log('JWT obtido com sucesso.');

  const authHeaders = { Authorization: `Bearer ${jwt}` };

  // Vamos testar dezenas de caminhos conhecidos do ecossistema Garmin para treinos futuros / agendados / calendário
  const candidates = [
    // 1. No domínio personal.connectapi.garmin.com
    { host: 'personal', path: '/trainingplan-service/trainingplan/scheduledWorkouts' },
    { host: 'personal', path: '/trainingplan-service/scheduledWorkouts' },
    { host: 'personal', path: '/workout-service/scheduledWorkouts' },
    { host: 'personal', path: '/workout-service/schedule' },
    { host: 'personal', path: '/workout-service/workouts' },
    { host: 'personal', path: '/workout-service/workout' },
    { host: 'personal', path: '/calendar-service/year/2026/month/11' }, // Nov
    { host: 'personal', path: '/calendar-service/year/2026/month/10' },
    { host: 'personal', path: '/calendar-service/month/2026-11' },
    { host: 'personal', path: '/calendar-service/schedule' },
    { host: 'personal', path: '/calendar-service/items' },
    { host: 'personal', path: '/fitness-service/trainingplan' },
    { host: 'personal', path: '/fitness-service/workouts' },
    { host: 'personal', path: '/fitness-service/scheduledWorkouts' },
    { host: 'personal', path: '/activitylist-service/activities/search/activities?start=0&limit=5&activityType=future' },

    // 2. No domínio connect.garmin.com com o Bearer token
    { host: 'connect', path: '/modern/proxy/calendar-service/year/2026/month/10' },
    { host: 'connect', path: '/modern/proxy/calendar-service/year/2026/month/11' },
    { host: 'connect', path: '/modern/proxy/workout-service/workouts' },
    { host: 'connect', path: '/modern/proxy/trainingplan-service/trainingplan/scheduledWorkouts' },
    { host: 'connect', path: '/workout-service/workouts' },
    { host: 'connect', path: '/calendar-service/year/2026/month/10' },
  ];

  for (const c of candidates) {
    const url = c.host === 'personal' ? `${BASE_URL}${c.path}` : `https://connect.garmin.com${c.path}`;
    try {
      const resp = await axios.get(url, { headers: authHeaders, timeout: 5000 });
      console.log(`[SUCCESS] (${c.host}) ${c.path} -> ${resp.status}`);
      console.log('   Data:', JSON.stringify(resp.data).slice(0, 300));
    } catch (err) {
      console.log(`[FAIL ${err?.response?.status || err?.code}] (${c.host}) ${c.path}`);
    }
  }
}

main().catch(console.error);

