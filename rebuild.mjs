
import fs from 'fs/promises';
import path from 'path';
export const handler = async () => {
  const ts = new Date().toISOString();
  return { statusCode:200, body: JSON.stringify({ ok:true, rebuiltAt: ts }) };
};
