import "dotenv/config";
import { Client } from "pg";

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`select id, business_name, city, latitude, longitude from vendors order by id desc limit 10`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
