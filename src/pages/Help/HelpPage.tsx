import { useState, type ReactNode } from 'react'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'

type Platform = 'iphone' | 'android'

/** iPhone/iPad por defecto si el navegador lo dice; si no, Android. */
function detectPlatform(): Platform {
  try {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iphone' : 'android'
  } catch {
    return 'android'
  }
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold">{children}</ol>
}

function Topic({
  title,
  children,
  open = false,
}: {
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">{title}</summary>
      <div className="flex flex-col gap-3 pt-1 pb-2 text-[0.9375rem] leading-relaxed">
        {children}
      </div>
    </details>
  )
}

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-fg-muted">{children}</p>
)

/** Tutorial de uso: instalar en el celular y recorrido por cada parte de la app. */
export function HelpPage() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform)

  return (
    <Page>
      <PageHeader
        title="Cómo usar Freyapp"
        back="/ajustes"
        description="Una guía corta, de lo primero a lo más avanzado."
      />
      <div className="flex flex-col gap-3">
        <Topic title="1. Ponla en la pantalla de inicio de tu celular" open>
          <p>
            Así se abre como cualquier app, sin la barra del navegador. No necesitas tienda de
            aplicaciones ni pagar nada.
          </p>
          <Segmented
            label="Mi celular es"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: 'iphone', label: 'iPhone' },
              { value: 'android', label: 'Android' },
            ]}
          />
          {platform === 'iphone' ? (
            <>
              <Steps>
                <li>
                  Abre la dirección de Freyapp en <strong>Safari</strong> (la brújula azul). Con
                  otros navegadores la opción puede no aparecer.
                </li>
                <li>
                  Toca el botón <strong>Compartir</strong>: un cuadrado con una flecha hacia arriba,
                  abajo en el centro de la pantalla.
                </li>
                <li>
                  Desliza el menú hacia arriba y toca <strong>«Agregar a inicio»</strong>.
                </li>
                <li>
                  Déjale el nombre «Freyapp» y toca <strong>Agregar</strong>, arriba a la derecha.
                </li>
                <li>Listo: el ícono queda en tu pantalla de inicio. Ábrelo desde ahí.</li>
              </Steps>
              <Muted>
                Si no ves «Agregar a inicio», baja hasta el final de la lista y toca «Editar
                acciones» para activarla.
              </Muted>
            </>
          ) : (
            <>
              <Steps>
                <li>
                  Abre la dirección de Freyapp en <strong>Chrome</strong>.
                </li>
                <li>
                  Toca los <strong>tres puntos (⋮)</strong> arriba a la derecha.
                </li>
                <li>
                  Elige <strong>«Instalar aplicación»</strong> o{' '}
                  <strong>«Añadir a pantalla de inicio»</strong>; el nombre cambia según la versión.
                </li>
                <li>
                  Confirma con <strong>Instalar</strong> (o <strong>Añadir</strong>).
                </li>
                <li>Listo: el ícono queda en tu pantalla de inicio y en el cajón de apps.</li>
              </Steps>
              <Muted>
                En un Samsung funciona igual desde Chrome. Si usas Samsung Internet, el menú está
                abajo a la derecha (≡) y la opción se llama «Añadir página a» → «Pantalla de
                inicio».
              </Muted>
            </>
          )}
        </Topic>

        <Topic title="2. Crear tu cuenta">
          <Steps>
            <li>Entra a la dirección de Freyapp y toca «Crear cuenta».</li>
            <li>
              Usa tu correo y una contraseña, o entra con Google. Si te llega un correo para
              confirmar, ábrelo y toca el enlace.
            </li>
            <li>
              La primera vez te pide un nombre: la app crea tu espacio personal «Mis finanzas». Si
              alguien te dio un código de invitación, escríbelo ahí para unirte a su hogar.
            </li>
          </Steps>
          <Muted>
            ¿Olvidaste la contraseña? En la pantalla de entrada toca «Recuperar» y te llega un
            enlace por correo.
          </Muted>
        </Topic>

        <Topic title="3. Inicio: anotar gastos e ingresos">
          <p>
            En Inicio ves cuánto dinero tienes disponible y tus últimos movimientos. Los botones de
            abajo (o de la barra lateral en computador) siempre están a mano:
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <strong>+ Gasto</strong>: valor, en qué fue y fecha. Es lo que más vas a usar.
            </li>
            <li>
              <strong>+ Ingreso</strong>: lo que te entra (mesada, pago, regalo).
            </li>
          </ul>
          <Muted>
            Si te equivocas, abre el movimiento y corrígelo o anúlalo. Nada se borra a escondidas:
            lo anulado queda marcado.
          </Muted>
        </Topic>

        <Topic title="4. Mi plan del mes">
          <p>
            Aquí armas tu mes de antemano: lo que entra, lo fijo que sale y lo que ahorras. Lo que
            sobra es tu <strong>Dinero mío</strong>, el que puedes gastar libremente. Solo tú ves tu
            plan.
          </p>
          <Steps>
            <li>
              Toca «Cargar un plan de ejemplo» para ver cómo funciona, o «Empezar desde cero».
            </li>
            <li>Cambia los valores por los tuyos: ingresos, gastos fijos y ahorro mensual.</li>
            <li>
              Cuando pagues algo fijo, <strong>márcalo con la casilla</strong>: así sabes qué falta.
            </li>
          </Steps>
          <p>
            <strong>Gasolina y otros gastos con tope.</strong> Activa «llevar registro» en una línea
            y anota cada tanqueada: la app te dice cuánto del tope llevas y descuenta de «Dinero
            mío» lo que te pases.
          </p>
          <p>
            <strong>Recibos que cambian cada mes (luz, agua, gas).</strong> Ponles un tope, y cuando
            llegue el recibo anota el valor a mano o adjunta la foto o el PDF. En el PDF la app
            sugiere el total y la fecha, pero siempre tú confirmas.
          </p>
          <p>
            <strong>Avisos de pago.</strong> En cada línea puedes poner el día de pago y cuántos
            días antes quieres el aviso. Con «Avisos en mi calendario» descargas un archivo que, al
            abrirlo, crea los recordatorios mensuales en el calendario de tu celular.
          </p>
        </Topic>

        <Topic title="5. Tarjetas de crédito">
          <Steps>
            <li>
              En «Tarjetas» toca «+ Tarjeta». Pon el nombre y los últimos 4 dígitos (nunca el número
              completo).
            </li>
            <li>
              Sube el <strong>extracto</strong> (PDF o foto) con «+ Extracto». Si es de Bancolombia,
              la app lee el total, el mínimo, la fecha límite y la cuota de manejo; revisa que estén
              bien.
            </li>
            <li>
              Elige en qué <strong>mes de tu presupuesto</strong> se paga ese extracto (por defecto
              es el siguiente al corte; puedes cambiarlo).
            </li>
            <li>
              Registra tus pagos: <strong>mínimo</strong> o <strong>abono</strong>, en pesos o en
              dólares por separado.
            </li>
          </Steps>
          <p>
            La página de cada tarjeta también calcula los <strong>intereses estimados</strong> y
            cuánto ahorras si abonas antes del corte, muestra el <strong>dólar del día</strong> y
            guarda los gastos que vas haciendo con la tarjeta para que no te sorprenda el próximo
            extracto.
          </p>
          <Muted>
            Los intereses son una estimación; el valor oficial es el que trae tu extracto.
          </Muted>
        </Topic>

        <Topic title="6. Dinero personal, presupuestos y reportes">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Dinero personal / Mi dinero:</strong> lo que llevas aparte del hogar. Es
              privado: nadie más lo ve.
            </li>
            <li>
              <strong>Presupuestos:</strong> un tope por categoría (comida, transporte…). La app te
              avisa cuando vas llegando.
            </li>
            <li>
              <strong>Reportes:</strong> gráficas de a dónde se va tu plata, mes a mes. Desde ahí
              también puedes sacar un extracto para imprimir o guardar en PDF.
            </li>
          </ul>
        </Topic>

        <Topic title="7. Registrar compras con Apple Pay automáticamente (solo iPhone)">
          <p>
            Con la app <strong>Atajos</strong> del iPhone puedes hacer que, al pagar con una tarjeta
            de tu Wallet, Freyapp se abra con el gasto ya escrito y solo toques «Guardar».
          </p>
          <Steps>
            <li>
              En Atajos ve a <strong>Automatización → «+» → Transacción</strong> y elige la tarjeta.
            </li>
            <li>
              Agrega la acción <strong>«Abrir URL»</strong> con el enlace de tu Freyapp seguido de
              <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-sm">
                /personal/gastos/nuevo?monto=…&amp;desc=…
              </code>
              , insertando como valores las variables <em>Cantidad</em> y <em>Comerciante</em> de la
              transacción.
            </li>
            <li>Desactiva «Preguntar antes de ejecutar» si quieres que corra sola.</li>
          </Steps>
          <Muted>
            Con <code>&amp;tarjeta=1234</code> (últimos 4 dígitos) y <code>&amp;tipo=T.Cred</code>{' '}
            la compra se anota en esa tarjeta de crédito; con <code>T.Deb</code> va a tu dinero
            personal.
          </Muted>
        </Topic>

        <Topic title="8. Si compartieron una libreta contigo">
          <p>
            Si alguien te compartió su libreta de «Mamá me debe», te aparece un botón en el menú con
            el nombre que él o ella eligió. Ahí ves cada cobro y cada pago con lo que se debía
            después de cada uno. Es <strong>solo lectura</strong>: no puedes cambiar nada y no ves
            el resto de su cuenta.
          </p>
          <Muted>
            Para verla debes haber creado tu cuenta con el mismo correo con el que te la
            compartieron.
          </Muted>
        </Topic>

        <Topic title="9. Bolsillos y «Mamá me debe» (si tu cuenta los tiene)">
          <p>
            <strong>Bolsillos</strong> copia los de tu banco: nombre, saldo y meta, con una barra de
            avance. Dentro de cada uno puedes meter y sacar dinero, trasladar o prestar a otro
            bolsillo, devolver lo prestado y «ajustar al saldo del banco» cuando algo no coincide.
          </p>
          <p>
            <strong>Mamá me debe</strong> es una libreta de cobros y pagos con el saldo en cada
            línea. Puedes pegar tu bitácora para importarla, crear cobros automáticos semanales o
            mensuales, y compartirla en solo lectura con quien quieras.
          </p>
        </Topic>

        <Topic title="10. Exportar y respaldos">
          <p>
            En <strong>Ajustes → Exportar</strong> descargas todo en Excel (una hoja por tema) o en
            archivos de texto. Es buena idea bajar un respaldo de vez en cuando.
          </p>
        </Topic>

        <Topic title="11. Privacidad y problemas frecuentes">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              Tu plan, tus tarjetas, tu dinero personal y tus bolsillos son{' '}
              <strong>privados</strong>: están protegidos en la base de datos y ni otro usuario ni
              el hogar los ven.
            </li>
            <li>
              <strong>«Algo salió mal» al guardar:</strong> recarga la página (tira hacia abajo en
              el celular). Si sigue, avisa a quien administra la app: puede faltar una
              actualización.
            </li>
            <li>
              <strong>Veo una versión vieja:</strong> cierra la app por completo y ábrela de nuevo.
            </li>
            <li>
              <strong>Cerrar sesión:</strong> Ajustes, hasta abajo.
            </li>
          </ul>
        </Topic>
      </div>
    </Page>
  )
}
