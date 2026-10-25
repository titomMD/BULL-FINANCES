# Atajo del iPhone: SMS de Bancolombia → Freyapp

Cada compra de Bancolombia llega por SMS (remitente 85437), por ejemplo:

- `Bancolombia: Compraste $4.800,00 en CEN CIAL LA FLORIDA con tu T.Deb *0879, el 21/02/2026 a las 18:46.`
- `Bancolombia: Compraste COP66.788,00 en FARMATODO ALTOS DE C con tu T.Cred *1068, el 20/08/2026 a las 10:41.`

Una automatización de Atajos lee el SMS y abre Freyapp con el gasto escrito; tú tocas «Guardar».

- `T.Deb` (débito) → gasto de **dinero personal**.
- `T.Cred` (crédito) → gasto de la **tarjeta** cuyos últimos 4 dígitos coincidan.

Enlace que abre el atajo:

```
https://TU-SITIO.netlify.app/personal/gastos/nuevo?monto=4.800,00&desc=CEN CIAL LA FLORIDA&tarjeta=0879&tipo=T.Deb
```

- `monto`: valor (con o sin puntos y comas), `desc`: comercio, `tarjeta`: últimos 4 dígitos o nombre,
  `tipo`: `T.Deb` o `T.Cred`, `moneda`: `COP` (por defecto) o `USD`, `fecha` (opcional): `AAAA-MM-DD`.
