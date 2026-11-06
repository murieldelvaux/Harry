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
  const authHeaders = { Authorization: `Bearer ${jwt}` };

  const paths = [
    // Wellness & summaries
    '/wellness-service/wellness/dailySummary',
    '/wellness-service/wellness/dailySummary?uploadStartTimeInSeconds=1793836800&uploadEndTimeInSeconds=1794441600',
    // Training plans / calendar
    '/trainingplan-service/trainingplan',
    '/trainingplan-service/trainingplans',
    '/trainingplans-service/trainingplans',
    '/calendar-service/calendar',
    '/calendar-service/activities',
    '/calendar-service/events',
    '/workout-service/workout',
    '/workout-service/workouts',
    '/activitylist-service/activities/scheduled',
    '/activitylist-service/activities/calendar',
    '/course-service/courses',
    '/userprofile-service/userprofile/personal-information',
  ];

  for (const p of paths) {
    try {
      const resp = await axios.get(`${BASE_URL}${p}`, { headers: authHeaders, timeout: 5000 });
      console.log(`[OK] ${p} -> ${resp.status}`);
    } catch (err) {
      console.log(`[ERR] ${p} -> ${err?.response?.status || err?.message}`);
    }
  }
}

main().catch(console.error);

