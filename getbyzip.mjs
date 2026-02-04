
import fs from 'fs/promises';
import path from 'path';

export const handler = async (event) => {
  const zip = (event.queryStringParameters?.code || '').trim();
  if (!/^\d{5}$/.test(zip)) return { statusCode: 400, body: JSON.stringify({ error:'Invalid ZIP' }) };
  try {
    const p = path.join(process.cwd(),'data','zip',`${zip}.json`);
    const raw = await fs.readFile(p,'utf-8');
    return { statusCode: 200, headers:{'content-type':'application/json'}, body: raw };
  } catch {
    return { statusCode: 404, body: JSON.stringify({ error:'Not found for this ZIP yet' }) };
  }
};
