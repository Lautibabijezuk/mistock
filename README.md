# MiStock

Sistema POS multirrubro para Argentina.

## Stack
- React 18 + Vite
- Supabase (DB + Auth + RLS)
- Lucide icons, Recharts, XLSX

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir http://localhost:5173

## Deploy a Vercel (la forma más rápida)

### Opción A: Vercel CLI (todo desde la terminal)

```bash
npm i -g vercel
vercel
```

Te pregunta:
1. Login → seleccioná tu cuenta
2. ¿Set up and deploy? → **Y**
3. ¿Scope? → tu cuenta personal
4. ¿Link to existing? → **N**
5. ¿Project name? → `mistock`
6. ¿Directory? → `.` (Enter)
7. ¿Override settings? → **N**

Listo. Te da una URL tipo `https://mistock.vercel.app`.

Después configurá las variables de entorno:
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_KEY
vercel --prod
```

### Opción B: GitHub + Vercel Dashboard (sin terminal)

1. Subí el código a un repositorio en github.com
2. Entrá a vercel.com → "Add New Project"
3. Importá el repo de GitHub
4. En "Environment Variables" agregá:
   - VITE_SUPABASE_URL = tu URL de Supabase
   - VITE_SUPABASE_KEY = tu clave publishable de Supabase
5. Click "Deploy"

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| VITE_SUPABASE_URL | URL del proyecto Supabase |
| VITE_SUPABASE_KEY | Publishable key (anon) de Supabase |

