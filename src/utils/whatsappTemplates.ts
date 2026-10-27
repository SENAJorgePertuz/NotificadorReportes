export interface MessageInvoiceData {
  invoice_number: string;
  patient_name: string;
  eps_folder: string;
  invoice_date?: string | null;
  biller_display_name?: string | null;
  biller_raw_name?: string | null;
  return_note?: string | null;
}

export interface WhatsAppTemplate {
  id: number;
  label: string;
  build: (data: MessageInvoiceData) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 1,
    label: 'Cercano & Directo',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `Hola *${facturador}*, ¿cómo vas? 👋
Te paso por aquí la novedad que nos rebotó el validador con esta factura:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Échale un ojito a los soportes cuando puedas porfa para dejarla lista. ¡Mil gracias! 👍`;
    },
  },
  {
    id: 2,
    label: 'Colaborativo & Compañero',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `¡Buenas, *${facturador}*! ¿Qué tal todo? 🙌
El validador nos acaba de marcar una devolución en esta cuenta:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Porfa revísate esos soportes a ver si la corregimos y la volvemos a subir. ¡Hablamos! 🤝`;
    },
  },
  {
    id: 3,
    label: 'Ágil & Al Grano',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `*${facturador}*, te comparto este reporte del validador para que nos colabores revisándolo porfa:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Cualquier ajuste me avisas para reintentar la subida al validador. ¡Quedo pendiente, gracias! 🚀`;
    },
  },
  {
    id: 4,
    label: 'Cálido & Cotidiano',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `Hola *${facturador}*, un saludo cordial. 👋
Mira que nos devolvieron esta factura en la validación:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Porfa nos ayudas ajustando el soporte según la nota para poder radicarla. ¡De una, gracias! ✨`;
    },
  },
  {
    id: 5,
    label: 'Práctico & Amigable',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `¡Hola *${facturador}*! Paso por acá para avisarte de esta novedad que arrojó el validador:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Nos pegas una ayudita revisando el caso porfa para sacarla adelante. ¡Muchas gracias, compañero! 🙏`;
    },
  },
  {
    id: 6,
    label: 'Fresco & Resolutivo',
    build: ({ invoice_number, patient_name, eps_folder, invoice_date, biller_display_name, biller_raw_name, return_note }) => {
      const facturador = biller_display_name || biller_raw_name || 'Compañero';
      const fecha = invoice_date || 'No especificada';
      const nota = (return_note || '').trim() || 'Revisión y ajuste de soportes requeridos.';

      return `¿Cómo va todo, *${facturador}*? Te escribo rápido por esta factura que nos salió con novedad en el validador:

📄 *Factura:* ${invoice_number}
👤 *Paciente:* ${patient_name}
🏢 *EPS:* ${eps_folder}
📅 *Fecha:* ${fecha}
👨‍💻 *Facturador:* ${facturador}
📝 *Nota de Devolución:* ${nota}

Regálanos una miradita a ver qué le falta al soporte y la dejamos corregida hoy. ¡Un abrazo! 💪`;
    },
  },
];

// Returns a random template index (0-5)
export function getRandomTemplateIndex(): number {
  return Math.floor(Math.random() * WHATSAPP_TEMPLATES.length);
}

// Builds message using a specific template index, or random if not specified
export function buildCoworkerWhatsAppMessage(data: MessageInvoiceData, templateIndex?: number): string {
  const index = templateIndex !== undefined && templateIndex >= 0 && templateIndex < WHATSAPP_TEMPLATES.length
    ? templateIndex
    : getRandomTemplateIndex();
  return WHATSAPP_TEMPLATES[index].build(data);
}
