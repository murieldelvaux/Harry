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

  const actId = 24949763699;
  const resp = await axios.get(`${BASE_URL}/activity-service/activity/${actId}/details`, { headers: authHeaders });
  console.log('metricDescriptors:', resp.data.metricDescriptors?.map(m => m.key));
  console.log('activityDetailMetrics count:', resp.data.activityDetailMetrics?.length);
  if (resp.data.activityDetailMetrics?.length > 0) {
    console.log('1st detail metric sample:', resp.data.activityDetailMetrics[0]);
  }
}

main().catch(console.error);

