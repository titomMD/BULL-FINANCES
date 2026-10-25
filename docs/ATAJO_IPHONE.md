# Atajo del iPhone: pagos de Wallet → Freyapp

Cuando pagas con una tarjeta de Wallet (Apple Pay), el iPhone puede abrir Freyapp con el gasto ya
escrito. Tú solo tocas «Guardar».

El enlace que abre el atajo (la app lee estos datos):

```
https://TU-SITIO.netlify.app/personal/gastos/nuevo?monto=45000&desc=Rappi&tarjeta=Visa&moneda=COP
```

- `monto`: valor del cobro (con o sin puntos y comas).
- `desc`: comercio.
- `tarjeta`: nombre de la tarjeta en Wallet o sus últimos 4 dígitos (se compara con tus tarjetas de Freyapp).
- `moneda`: `COP` (por defecto) o `USD`.
- `fecha` (opcional): `AAAA-MM-DD`.

Solo funciona con pagos hechos con Apple Pay: la tarjeta física o las compras online con el número
no avisan al iPhone.
