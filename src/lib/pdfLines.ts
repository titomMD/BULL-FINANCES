// Convierte un PDF en líneas de texto (de arriba abajo, de izquierda a derecha) para que
// statementPdf.ts las lea. Todo ocurre en tu navegador: el PDF no sale de tu computador.

interface TextItem {
  str: string
  transform: number[]
  hasEOL?: boolean
}

interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>
}

interface PdfDocument {
  numPages: number
  getPage(n: number): Promise<PdfPage>
  destroy(): Promise<void>
}

export interface PdfJsModule {
  getDocument(source: { data: Uint8Array; password?: string; isEvalSupported?: boolean }): {
    promise: Promise<PdfDocument>
  }
}

/** El PDF pide clave (o la clave dada no sirvió). */
export class PdfPasswordError extends Error {
  wrong: boolean
  constructor(wrong: boolean) {
    super(wrong ? 'wrong_password' : 'password_required')
    this.wrong = wrong
  }
}

const isText = (item: unknown): item is TextItem =>
  typeof item === 'object' && item !== null && 'str' in item && 'transform' in item

export async function extractPdfLines(
  pdfjs: PdfJsModule,
  data: ArrayBuffer,
  password?: string,
): Promise<string[]> {
  let doc: PdfDocument
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(data),
      password,
      isEvalSupported: false,
    }).promise
  } catch (error) {
    const named = error as { name?: string; code?: number }
    if (named.name === 'PasswordException') throw new PdfPasswordError(named.code === 2)
    throw error
  }
  const lines: string[] = []
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const rows = new Map<number, Array<{ x: number; text: string }>>()
      for (const item of content.items) {
        if (!isText(item) || !item.str.trim()) continue
        const y = Math.round(item.transform[5] / 3) // tolera diferencias de 1-2 puntos
        const row = rows.get(y) ?? []
        const x = item.transform[4]
        const text = item.str.trim()
        // Algunos PDF imprimen el mismo texto 2-3 veces encimado (efecto de negrita): se descarta.
        if (row.some((cell) => cell.text === text && Math.abs(cell.x - x) < 3)) continue
        row.push({ x, text })
        rows.set(y, row)
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        const row = rows.get(y)!.sort((a, b) => a.x - b.x)
        lines.push(row.map((cell) => cell.text).join(' '))
      }
    }
  } finally {
    await doc.destroy()
  }
  return lines
}

/** Carga pdf.js solo cuando se necesita (pesa bastante) y lee el archivo. */
export async function readPdfLines(file: File, password?: string): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return extractPdfLines(pdfjs as unknown as PdfJsModule, await file.arrayBuffer(), password)
}
