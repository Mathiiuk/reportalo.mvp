// REP-2908-VERIF (V-04): crea los 6 usuarios demo en Supabase Auth que pide
// la guia v2.3 (seccion 4, paso 4) antes de correr la PARTE 3 del seed.
//
// Corre esto VOS en tu propia terminal -- no lo ejecuta el agente. La clave
// service_role nunca se pasa por el chat: se toma de una variable de entorno
// local.
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<tu clave service_role nueva>"
//   node scripts/rag-local-dev/create-demo-auth-users.mjs
//
// Uso (bash):
//   SUPABASE_SERVICE_ROLE_KEY="<tu clave service_role nueva>" node scripts/rag-local-dev/create-demo-auth-users.mjs

const SUPABASE_URL = 'https://yryuhyiujyignkdhiyua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Test123456';

if (!SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. No se ejecuta nada.');
  process.exit(1);
}

const USERS = [
  'ciudadano.demo@reportalo.test',
  'ciudadano.vecino@reportalo.test',
  'ciudadano.consulta@reportalo.test',
  'oficial.caba@reportalo.test',
  'oficial.avellaneda@reportalo.test',
  'admin.reportalo@reportalo.test',
];

async function createUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data?.msg?.includes('already been registered') || data?.code === 'email_exists') {
      console.log(`  ${email} -> ya existia, se omite`);
      return null;
    }
    throw new Error(`${email} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  console.log(`  ${email} -> creado (id: ${data.id})`);
  return data.id;
}

async function main() {
  console.log(`Creando ${USERS.length} usuarios demo en Auth...`);
  for (const email of USERS) {
    await createUser(email);
  }
  console.log('Listo.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
