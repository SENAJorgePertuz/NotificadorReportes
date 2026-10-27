import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

// PostgreSQL Connection
let rawDbUrl = process.env.DATABASE_URL || 'postgres://avnadmin:AVNS_hlNQtG60Q1lmJ3MCAjN@pg-19f18a9a-jorgepertuz-57eb.h.aivencloud.com:28418/defaultdb?sslmode=require';
// Remove sslmode query param so pg respects ssl: { rejectUnauthorized: false }
const cleanDbUrl = rawDbUrl.replace(/\?sslmode=[^&]+/, '').replace(/&sslmode=[^&]+/, '');

export const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 15,
  connectionTimeoutMillis: 10000,
});

// Redis Connection
const redisUrl = process.env.REDIS_URL || 'rediss://default:AadCAAIgcDFiZjk2ZTljNjhkOTY0NzgyOTIxMjkyZTZiNzA2ZmUzNg@charmed-tapir-42818.upstash.io:6379';
export let redisClient: Redis | null = null;
try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 8000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  redisClient.on('error', (err) => {
    console.warn('[Redis] Connection warning:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully to Upstash Redis');
  });
} catch (e: any) {
  console.warn('[Redis] Initialization error:', e.message);
}

// Function to parse the folder path according to the user specification:
// (E:\REPOSITORIOS2026\bot_soportes_giza\Pendientes_de_Subir_al_Validador\ ) -> Base path
// (COOSALUD\ ) -> EPS
// (JAIME\ ) -> Facturador
// (57305732-2026-10-22\soportes unificados) -> Paciente / Identificación / Subcarpeta
export function parseFolderPath(folderPath: string, epsFolderHint?: string) {
  // Normalize slashes
  const normalized = folderPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  let basePath = '';
  let extractedEps = epsFolderHint || '';
  let extractedBiller = 'DESCONOCIDO';
  let patientFolder = '';

  // Look for eps index
  const epsTarget = (epsFolderHint || '').trim().toLowerCase();
  let epsIndex = -1;

  if (epsTarget) {
    epsIndex = parts.findIndex(p => p.trim().toLowerCase() === epsTarget);
  }

  // If not found by exact eps target, check common EPS keywords
  if (epsIndex === -1) {
    epsIndex = parts.findIndex(p => 
      ['coosalud', 'nueva eps', 'mutual ser', 'proteger', 'sura', 'salud total', 'sanitas', 'cajacopi', 'famisanar', 'asmet salud'].some(eps => p.toLowerCase().includes(eps))
    );
  }

  if (epsIndex !== -1) {
    extractedEps = parts[epsIndex];
    basePath = parts.slice(0, epsIndex).join('\\') + '\\';
    
    // The folder directly after EPS is the Facturador
    if (epsIndex + 1 < parts.length) {
      extractedBiller = parts[epsIndex + 1];
    }
    
    // The folder after Facturador is patient id / folder
    if (epsIndex + 2 < parts.length) {
      patientFolder = parts[epsIndex + 2];
    }
  } else {
    // Fallback: check penultimate parts
    if (parts.length >= 4) {
      const soportesIndex = parts.findIndex(p => p.toLowerCase().includes('soportes'));
      if (soportesIndex >= 3) {
        patientFolder = parts[soportesIndex - 1];
        extractedBiller = parts[soportesIndex - 2];
        extractedEps = parts[soportesIndex - 3];
        basePath = parts.slice(0, soportesIndex - 3).join('\\') + '\\';
      }
    }
  }

  return {
    basePath: basePath || 'E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\',
    eps: extractedEps || epsFolderHint || 'OTRA EPS',
    billerRaw: extractedBiller.trim(),
    patientFolder: patientFolder.trim(),
  };
}

// Database schema initialization
export async function initDb() {
  console.log('[PostgreSQL] Initializing tables and schema in Aiven Cloud...');
  
  const client = await pool.connect();
  try {
    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Operador',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);

    // 2. Facturadores (Billers) table
    await client.query(`
      CREATE TABLE IF NOT EXISTS billers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        display_name VARCHAR(150),
        phone VARCHAR(50),
        email VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Biller Aliases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS biller_aliases (
        id SERIAL PRIMARY KEY,
        biller_id INTEGER REFERENCES billers(id) ON DELETE CASCADE,
        alias VARCHAR(150) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Upload Batches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS upload_batches (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255),
        total_records INTEGER DEFAULT 0,
        duplicates_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        uploaded_by_username VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 5. Invoice Records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_records (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER REFERENCES upload_batches(id) ON DELETE SET NULL,
        patient_name VARCHAR(255) NOT NULL,
        eps_folder VARCHAR(100) NOT NULL,
        biller_raw_name VARCHAR(150),
        biller_id INTEGER REFERENCES billers(id) ON DELETE SET NULL,
        folder_path TEXT NOT NULL,
        base_path TEXT,
        subfolder_patient TEXT,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date VARCHAR(50),
        regimen VARCHAR(50),
        contract_id VARCHAR(50),
        contract_name VARCHAR(255),
        files_to_upload JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL,
        error_reason TEXT,
        return_note TEXT,
        whatsapp_notified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_invoice_patient UNIQUE (invoice_number, patient_name)
      );
    `);

    // Ensure return_note column exists in existing database
    await client.query(`ALTER TABLE invoice_records ADD COLUMN IF NOT EXISTS return_note TEXT;`);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoice_records (invoice_number);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eps_folder ON invoice_records (eps_folder);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_status ON invoice_records (status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_biller_raw_name ON invoice_records (biller_raw_name);`);

    // Seed default Users if not exists
    const usersCount = await client.query(`SELECT COUNT(*) FROM users;`);
    if (parseInt(usersCount.rows[0].count) === 0) {
      console.log('[PostgreSQL] Seeding initial users...');
      const superAdminPass = await bcrypt.hash('Admin2026*', 10);
      const adminPass = await bcrypt.hash('Admin2026*', 10);
      const operadorPass = await bcrypt.hash('Operador2026*', 10);

      await client.query(`
        INSERT INTO users (username, email, password_hash, full_name, role) VALUES
        ('superadmin', 'superadmin@giza.salud.com', $1, 'Super Administrador GIZA', 'SuperAdmin'),
        ('admin', 'admin@giza.salud.com', $2, 'Administrador Facturación', 'Admin'),
        ('operador', 'operador@giza.salud.com', $3, 'Operador Radicación RIPS', 'Operador');
      `, [superAdminPass, adminPass, operadorPass]);
    }

    // Seed default Billers and Aliases if not exists
    const billersCount = await client.query(`SELECT COUNT(*) FROM billers;`);
    if (parseInt(billersCount.rows[0].count) === 0) {
      console.log('[PostgreSQL] Seeding initial facturadores & aliases...');
      
      // Jaime
      const resJaime = await client.query(`
        INSERT INTO billers (name, display_name, phone, email, notes)
        VALUES ('JAIME', 'Jaime Pertuz', '+573008967451', 'jaime.facturacion@hospital.com', 'Facturador principal grupo Jaime')
        RETURNING id;
      `);
      const jaimeId = resJaime.rows[0].id;

      await client.query(`
        INSERT INTO biller_aliases (biller_id, alias) VALUES
        ($1, 'JAIME'),
        ($1, 'JAYME'),
        ($1, 'JAIME PERTUZ'),
        ($1, 'JAIME P'),
        ($1, 'JAIMITO');
      `, [jaimeId]);

      // Jhon
      const resJhon = await client.query(`
        INSERT INTO billers (name, display_name, phone, email, notes)
        VALUES ('JHON', 'Jhon Bornacelly', '+573145628990', 'jhon.facturacion@hospital.com', 'Facturador de cirugías y eventos')
        RETURNING id;
      `);
      const jhonId = resJhon.rows[0].id;

      await client.query(`
        INSERT INTO biller_aliases (biller_id, alias) VALUES
        ($1, 'JHON'),
        ($1, 'JOHN'),
        ($1, 'JHONNY'),
        ($1, 'JHON BORNACELLY'),
        ($1, 'JON');
      `, [jhonId]);
    }

    // Seed initial invoices from user prompt if table is empty
    const invoicesCount = await client.query(`SELECT COUNT(*) FROM invoice_records;`);
    if (parseInt(invoicesCount.rows[0].count) === 0) {
      console.log('[PostgreSQL] Seeding initial dataset from user prompt...');
      const initialJsonData = [
        {
          "patient_name": "5062316-2026-10-22",
          "eps_folder": "PROTEGER",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\PROTEGER\\JAIME\\5062316-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78965",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "36",
          "contract_name": "PROTEGER SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78965 ya existe"
        },
        {
          "patient_name": "ELVA CRESPO DE BORNACELLY",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JHON\\ELVA CRESPO DE BORNACELLY\\soportes unificados",
          "invoice_number": "HSHJ79502",
          "invoice_date": "24/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "LUIS ALFONSO PERTUZ BENAVIDES",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JHON\\LUIS ALFONSO PERTUZ BENAVIDES\\soportes unificados",
          "invoice_number": "HSHJ79475",
          "invoice_date": "24/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "MANUEL ARTURO HERNANDEZ PERTUZ",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JHON\\MANUEL ARTURO HERNANDEZ PERTUZ\\soportes unificados",
          "invoice_number": "HSHJ78963",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "1004120537-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1004120537-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78860",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78860 ya existe"
        },
        {
          "patient_name": "1079915211-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1079915211-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78967",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78967 ya existe"
        },
        {
          "patient_name": "1079940107-2026-10-21",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1079940107-2026-10-21\\soportes unificados",
          "invoice_number": "HSHJ78506",
          "invoice_date": "21/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf",
            "Traslado asistencial de pacientes.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78506 ya existe"
        },
        {
          "patient_name": "1081758503-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1081758503-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78652",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78652 ya existe"
        },
        {
          "patient_name": "1081761880-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1081761880-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78968",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78968 ya existe"
        },
        {
          "patient_name": "1192724898-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\1192724898-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78812",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78812 ya existe"
        },
        {
          "patient_name": "7433027-2026-10-22",
          "eps_folder": "NUEVA EPS",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\NUEVA EPS\\JAIME\\7433027-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78966",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "10",
          "contract_name": "NUEVA EPS SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78966 ya existe"
        },
        {
          "patient_name": "LILIBETH JUDITH DE LA CRUZ VALENCIA",
          "eps_folder": "MUTUAL SER",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\MUTUAL SER\\JHON\\LILIBETH JUDITH DE LA CRUZ VALENCIA\\soportes unificados",
          "invoice_number": "HSHJ79445",
          "invoice_date": "24/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "40",
          "contract_name": "MUTUAL SER SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "YANET PATRICIA PRIETO JURE",
          "eps_folder": "MUTUAL SER",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\MUTUAL SER\\JHON\\YANET PATRICIA PRIETO JURE\\soportes unificados",
          "invoice_number": "HSHJ79425",
          "invoice_date": "24/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "40",
          "contract_name": "MUTUAL SER SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "JULIETH PAOLA YANCI GUTIERREZ",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JHON\\JULIETH PAOLA YANCI GUTIERREZ\\soportes unificados",
          "invoice_number": "HSHJ79435",
          "invoice_date": "24/10/2026",
          "regimen": "CONTRIBUTIVO",
          "contract_id": "31",
          "contract_name": "COOSALUD CONTRIBUTIVO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "OLGA PATRICIA JULIO SIERRA",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JHON\\OLGA PATRICIA JULIO SIERRA\\soportes unificados",
          "invoice_number": "HSHJ78964",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "COMPLETADO"
        },
        {
          "patient_name": "1081028152-2026-10-23",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JAIME\\1081028152-2026-10-23\\soportes unificados",
          "invoice_number": "HSHJ79106",
          "invoice_date": "23/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ79106 ya existe"
        },
        {
          "patient_name": "1083577840-2026-10-22",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JAIME\\1083577840-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78951",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78951 ya existe"
        },
        {
          "patient_name": "1083581030-2026-10-21",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JAIME\\1083581030-2026-10-21\\soportes unificados",
          "invoice_number": "HSHJ78504",
          "invoice_date": "21/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78504 ya existe"
        },
        {
          "patient_name": "57305732-2026-10-22",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JAIME\\57305732-2026-10-22\\soportes unificados",
          "invoice_number": "HSHJ78898",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78898 ya existe"
        },
        {
          "patient_name": "57309241-2026-10-23",
          "eps_folder": "COOSALUD",
          "folder_path": "E:\\REPOSITORIOS2026\\bot_soportes_giza\\Pendientes_de_Subir_al_Validador\\COOSALUD\\JAIME\\57309241-2026-10-23\\soportes unificados",
          "invoice_number": "HSHJ78969",
          "invoice_date": "22/10/2026",
          "regimen": "SUBSIDIADO",
          "contract_id": "32",
          "contract_name": "COOSALUD SUBSIDIADO EVENTO",
          "files_to_upload": [
            "Descripcion quirurgica.pdf",
            "Epicrisis.pdf",
            "Evidencia del envio del tramite respectivo.pdf",
            "Factura de Venta en Salud.pdf",
            "Hoja de administracion de medicamentos.pdf",
            "Orden o prescripcion facultativa (Orden Medica).pdf",
            "Registro de anestesia.pdf",
            "Resultado de los procedimientos o examenes diagnostico.pdf",
            "Resumen de atencion u hoja de evolucion.pdf"
          ],
          "status": "DUPLICADO",
          "error_reason": "El número de factura HSHJ78969 ya existe"
        }
      ];

      // Create an initial batch
      const batchRes = await client.query(`
        INSERT INTO upload_batches (filename, total_records, duplicates_count, completed_count, uploaded_by_username)
        VALUES ('Lote_Inicial_Bot_Soportes_GIZA.json', $1, $2, $3, 'superadmin')
        RETURNING id;
      `, [
        initialJsonData.length,
        initialJsonData.filter(i => i.status === 'DUPLICADO').length,
        initialJsonData.filter(i => i.status === 'COMPLETADO').length,
      ]);
      const batchId = batchRes.rows[0].id;

      // Get billers mapping with aliases
      const aliasRows = await client.query(`
        SELECT ba.alias, b.id as biller_id 
        FROM biller_aliases ba
        JOIN billers b ON ba.biller_id = b.id;
      `);
      const aliasMap = new Map<string, number>();
      for (const row of aliasRows.rows) {
        aliasMap.set(row.alias.trim().toUpperCase(), row.biller_id);
      }

      for (const item of initialJsonData) {
        const parsed = parseFolderPath(item.folder_path, item.eps_folder);
        const resolvedBillerId = aliasMap.get(parsed.billerRaw.toUpperCase()) || null;

        await client.query(`
          INSERT INTO invoice_records (
            batch_id, patient_name, eps_folder, biller_raw_name, biller_id,
            folder_path, base_path, subfolder_patient, invoice_number,
            invoice_date, regimen, contract_id, contract_name, files_to_upload,
            status, error_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (invoice_number, patient_name) DO UPDATE SET
            folder_path = EXCLUDED.folder_path,
            status = EXCLUDED.status,
            error_reason = EXCLUDED.error_reason,
            files_to_upload = EXCLUDED.files_to_upload,
            updated_at = NOW();
        `, [
          batchId,
          item.patient_name,
          item.eps_folder,
          parsed.billerRaw,
          resolvedBillerId,
          item.folder_path,
          parsed.basePath,
          parsed.patientFolder,
          item.invoice_number,
          item.invoice_date,
          item.regimen,
          item.contract_id,
          item.contract_name,
          JSON.stringify(item.files_to_upload),
          item.status,
          item.error_reason || null,
        ]);
      }
      console.log(`[PostgreSQL] Successfully seeded ${initialJsonData.length} initial invoices into defaultdb.`);
    }

    console.log('[PostgreSQL] Database schema verified and ready.');
  } finally {
    client.release();
  }
}
