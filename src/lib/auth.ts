import type { Credential } from './types';

/* Authentication (SHA-256 hashed credentials) — same scheme as the original page.
   Each entry: SHA-256(email.toLowerCase()) + SHA-256(password).
   Brute-force protection lives in the login page: 5 attempts → 30s lockout → doubles each time. */
export const SEED_CREDENTIALS: Record<string, Credential> = {
  "michael": {teamId:"mh", emailHash:"da0f116e4bd52fd802094752ba227a1af2e7719da19d8bc3f165943953b3dd2d", passHash:"bbc5c574b8e7c51903e09d4e8625a0a4f6b8815e9f97552458275e91a78f082e"},
  "admin":   {teamId:"fh", emailHash:"027e7aab7aa721cef8944deb2e703471ac95c2217fc0110a4db973e53d545361", passHash:"98a23782b00a2fd4eb9a7f6b575ece28d60d30e958c53046a12e98c532b2bc32"},
  "vache":   {teamId:"vs", emailHash:"fac206abaffcfadc1a3bf3482b2c165de7929def6cc7fd3654b3e03e949bae6f", passHash:"d7201bfbd19cffd4b708b611f5eb6d251fda106b64f672bde3e1785c788fe1b7"},
  "lia":     {teamId:"ln", emailHash:"1a1b6b77298a12a0989d25fd14f71087c809f9d87f8f74ac644a6f6b9066d1e4", passHash:"ebe36b3cee9025764d5af35f7c067655034c770f2354dd5a69f0b01a6eca8e8b"},
  "mariam":  {teamId:"md", emailHash:"a60fb1bd341e25746a79dd57160b224fc271ea19692f2356c4717fcf0bfeeea7", passHash:"8e4cef22ebf378c45bfef2a950faef7cd5eacb48b2e82fa856935a006cbb82a8"},
  "larisa":  {teamId:"lp", emailHash:"132b136dabcefb4ac5c7a642d911965a42ac5145a8a2259c5195503de3c27e79", passHash:"74b09f02212371fa5c136bfa9a982597076ed359871b6327bce1ee8a2df71e4e"},
  "anahit":  {teamId:"ap", emailHash:"19fc39fc1244131649f2218eac8b23931de311067139b453fb81c80b13ab52c1", passHash:"849dcd62a0b873eacb9866a46cd8a679978396c90a790e5bb5a1e320c0f1c64f"},
  "meline":  {teamId:"mn", emailHash:"f980bafbb2218f6f774f769059921d5aec736350528035e6765895fc3225e90e", passHash:"5558f09233f9727f775fc99ce3b9e30fa1b76fe53119681ae5691f7b33362733"},
  "papin":   {teamId:"pk", emailHash:"04a322223e50022b42dfb539426fc7a72b1e7eb477001163081deef19fa76013", passHash:"5acf0d5359dfceaec5186b75ca606c69b9b59d712339c275398af26b0584c7fd"},
};

export async function sha256hex(str: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const SESSION_KEY = 'retrieve_session';
