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
  console.log('JWT obtido com sucesso. Comprimento:', jwt.length);

  const authHeaders = { Authorization: `Bearer ${jwt}` };

  // 2. Testar endpoints comuns do Garmin Connect Personal API
  const endpointsToTest = [
    // Atividades recentes
    { name: 'activities', url: `${BASE_URL}/activitylist-service/activities/search/activities?start=0&limit=10` },
    // Calendário / Treinos agendados
    { name: 'calendar_month', url: `${BASE_URL}/calendar-service/year/2026/month/10` }, // Nov é mês 10 (0-indexed) ou 11 (1-indexed)?
    { name: 'calendar_month_11', url: `${BASE_URL}/calendar-service/year/2026/month/11` },
    { name: 'calendar_schedule', url: `${BASE_URL}/calendar-service/schedule` },
    { name: 'trainingplan_scheduled', url: `${BASE_URL}/trainingplan-service/trainingplan/scheduledWorkouts` },
    { name: 'workout_list', url: `${BASE_URL}/workout-service/workouts` },
    { name: 'workout_schedule', url: `${BASE_URL}/workout-service/schedules` },
    { name: 'user_profile', url: `${BASE_URL}/userprofile-service/userprofile/user-settings` },
    { name: 'user_summary', url: `${BASE_URL}/usersummary-service/usersummary/daily` },
    { name: 'device_info', url: `${BASE_URL}/device-service/devices` },
  ];

  for (const ep of endpointsToTest) {
    try {
      const resp = await axios.get(ep.url, { headers: authHeaders, timeout: 6000 });
      console.log(`[SUCCESS] ${ep.name} (${ep.url}): status=${resp.status}, data length/keys=`, 
        Array.isArray(resp.data) ? `Array(${resp.data.length})` : typeof resp.data === 'object' ? Object.keys(resp.data) : typeof resp.data
      );
      if (Array.isArray(resp.data) && resp.data.length > 0) {
        console.log(`  Sample 1st item of ${ep.name}:`, JSON.stringify(resp.data[0]).slice(0, 300));
      } else if (typeof resp.data === 'object' && resp.data !== null) {
        console.log(`  Sample data of ${ep.name}:`, JSON.stringify(resp.data).slice(0, 300));
      }
    } catch (err) {
      console.log(`[FAIL] ${ep.name} (${ep.url}): ${err?.response?.status || err?.message}`);
    }
  }
}

main().catch(console.error);

