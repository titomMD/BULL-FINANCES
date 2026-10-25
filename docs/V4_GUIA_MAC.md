# Freyapp v4 · cómo actualizar (Mac)

1. En Finder abre la carpeta del proyecto (la que está clonada con GitHub Desktop) y copia encima el contenido de la v4 (incluye archivos ocultos: ⌘ + ⇧ + . para verlos).
2. Terminal, dentro de la carpeta: `npm install` y luego `npm run db:push` (crea las tablas nuevas y el almacenamiento privado de archivos).
3. GitHub Desktop: escribe un resumen (por ejemplo "V4"), «Commit to main» y «Push origin».
4. Netlify publica solo. Abre Freyapp, entra a «Mi plan» y pulsa los dos ajustes sugeridos («Llamarlo Membresías» y «Llevar tanqueadas»).
