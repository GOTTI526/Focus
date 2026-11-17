# FocusOS

Aplicación web de gestión operativa con paneles para administrador, supervisor y operador.

🔗 **Demo:** https://focus-lake-mu.vercel.app

## Tecnologías
React, Vite, Tailwind CSS, Supabase (PostgreSQL y Auth) y xlsx.

## Instalación
```bash
git clone https://github.com/GOTTI526/Focus.git
cd Focus
npm install
```

Crea un archivo `.env` en la raíz con:
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_publicable
```

Luego ejecuta:
```bash
npm run dev
```

> Las credenciales de la base de datos no están incluidas. Se necesita un proyecto propio en Supabase.
