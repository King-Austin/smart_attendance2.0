import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=([^\r\n]+)/)[1].trim();
const ref = env.match(/SUPABASE_PROJECT_REF=([^\r\n]+)/)[1].trim();

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const data = await res.json();
console.log("Functions status:", res.status);
console.log("Functions data:", data);
