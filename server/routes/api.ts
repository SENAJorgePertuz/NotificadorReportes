import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool, redisClient, parseFolderPath } from '../db.js';
import { authenticateToken, requireRole, generateToken, AuthenticatedRequest } from '../auth.js';

export const apiRouter = express.Router();

// ==========================================
// 1. HEALTH CHECK (Postgres + Redis)
// ==========================================
apiRouter.get('/health', async (_req: Request, res: Response) => {
  let postgresStatus = 'Desconectado';
  let redisStatus = 'Desconectado';
  let latencyMs = 0;

  const start = Date.now();
  try {
    const pgRes = await pool.query('SELECT NOW() as now, current_database() as db;');
    postgresStatus = pgRes.rows.length > 0 ? `Conectado (${pgRes.rows[0].db})` : 'Sin respuesta';
  } catch (err: any) {
    postgresStatus = `Error: ${err.message}`;
  }

  try {
    if (redisClient && redisClient.status === 'ready') {
      const pong = await redisClient.ping();
      redisStatus = pong === 'PONG' ? 'Conectado (Upstash Redis)' : 'Sin respuesta';
    } else {
      redisStatus = 'Conectando / Standby';
    }
  } catch (err: any) {
    redisStatus = `Error: ${err.message}`;
  }
  latencyMs = Date.now() - start;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    postgres: postgresStatus,
    redis: redisStatus,
    latencyMs,
  });
});

// ==========================================
// 2. AUTHENTICATION & USERS
// ==========================================
apiRouter.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    return;
  }

  try {
    const userRes = await pool.query(
      `SELECT id, username, email, password_hash, full_name, role, is_active FROM users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1);`,
      [username.trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Credenciales inválidas. Usuario no encontrado.' });
      return;
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      res.status(403).json({ error: 'Usuario inactivo. Contacte al SuperAdmin.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciales inválidas. Contraseña incorrecta.' });
      return;
    }

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error en el servidor al autenticar.', details: err.message });
  }
});

apiRouter.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// List all users (SuperAdmin & Admin)
apiRouter.get('/auth/users', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, is_active, created_at, last_login 
       FROM users ORDER BY created_at DESC;`
    );
    res.json({ users: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al listar usuarios.', details: err.message });
  }
});

// Create new user (SuperAdmin & Admin)
apiRouter.post('/auth/users', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { username, email, password, full_name, role } = req.body;

  if (!username || !email || !password || !full_name) {
    res.status(400).json({ error: 'Todos los campos son requeridos.' });
    return;
  }

  // Admin cannot create SuperAdmin
  const currentUserRole = req.user?.role;
  const targetRole = role || 'Operador';
  if (currentUserRole !== 'SuperAdmin' && targetRole === 'SuperAdmin') {
    res.status(403).json({ error: 'Solo un SuperAdmin puede asignar el rol SuperAdmin.' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, full_name, role, is_active, created_at;`,
      [username.trim(), email.trim(), passwordHash, full_name.trim(), targetRole]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'El nombre de usuario o email ya existe en la base de datos.' });
      return;
    }
    res.status(500).json({ error: 'Error al crear usuario.', details: err.message });
  }
});

// Update user role or active status (SuperAdmin only)
apiRouter.put('/auth/users/:id/role', authenticateToken, requireRole(['SuperAdmin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role, is_active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET role = COALESCE($1, role), is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, username, email, full_name, role, is_active;`,
      [role, is_active, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al actualizar usuario.', details: err.message });
  }
});

// ==========================================
// 3. FACTURADORES & ALIASES (Biller Directory)
// ==========================================
apiRouter.get('/billers', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all billers with their aliases and count of associated invoices
    const billersRes = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.display_name,
        b.phone,
        b.email,
        b.notes,
        b.created_at,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', ba.id, 'alias', ba.alias) ORDER BY ba.alias)
            FROM biller_aliases ba
            WHERE ba.biller_id = b.id
          ),
          '[]'::json
        ) as aliases,
        COUNT(DISTINCT ir.id) as invoice_count
      FROM billers b
      LEFT JOIN invoice_records ir ON b.id = ir.biller_id
      GROUP BY b.id
      ORDER BY b.display_name ASC, b.name ASC;
    `);

    res.json({ billers: billersRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener directorio de facturadores.', details: err.message });
  }
});

apiRouter.post('/billers', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, display_name, phone, email, notes, aliases } = req.body;

  if (!name) {
    res.status(400).json({ error: 'El código o nombre principal del facturador es obligatorio.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cleanName = name.trim().toUpperCase();
    const cleanDisplay = display_name ? display_name.trim() : cleanName;

    const billerRes = await client.query(
      `INSERT INTO billers (name, display_name, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [cleanName, cleanDisplay, phone?.trim() || null, email?.trim() || null, notes?.trim() || null]
    );

    const billerId = billerRes.rows[0].id;

    // Automatically add main name as an alias
    const aliasList: string[] = Array.isArray(aliases) ? aliases : [];
    if (!aliasList.some(a => a.trim().toUpperCase() === cleanName)) {
      aliasList.push(cleanName);
    }

    for (const a of aliasList) {
      if (a && a.trim()) {
        await client.query(
          `INSERT INTO biller_aliases (biller_id, alias)
           VALUES ($1, $2)
           ON CONFLICT (alias) DO NOTHING;`,
          [billerId, a.trim().toUpperCase()]
        );
      }
    }

    // Automatically link existing unlinked invoice records matching this biller or its aliases
    await client.query(`
      UPDATE invoice_records ir
      SET biller_id = $1
      WHERE ir.biller_id IS NULL AND (
        UPPER(ir.biller_raw_name) = $2
        OR UPPER(ir.biller_raw_name) = ANY($3::text[])
      );
    `, [billerId, cleanName, aliasList.map(a => a.trim().toUpperCase())]);

    await client.query('COMMIT');
    res.status(201).json({ biller: billerRes.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(400).json({ error: 'Ya existe un facturador con este nombre o alias.' });
      return;
    }
    res.status(500).json({ error: 'Error al registrar facturador.', details: err.message });
  } finally {
    client.release();
  }
});

apiRouter.put('/billers/:id', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { display_name, phone, email, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE billers
       SET display_name = COALESCE($1, display_name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING *;`,
      [display_name, phone, email, notes, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Facturador no encontrado.' });
      return;
    }

    res.json({ biller: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al actualizar facturador.', details: err.message });
  }
});

apiRouter.delete('/billers/:id', authenticateToken, requireRole(['SuperAdmin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM billers WHERE id = $1', [id]);
    res.json({ message: 'Facturador eliminado con éxito.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al eliminar facturador.', details: err.message });
  }
});

// Add alias to biller
apiRouter.post('/billers/:id/aliases', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { alias } = req.body;

  if (!alias || !alias.trim()) {
    res.status(400).json({ error: 'El alias no puede estar vacío.' });
    return;
  }

  const cleanAlias = alias.trim().toUpperCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resAlias = await client.query(
      `INSERT INTO biller_aliases (biller_id, alias)
       VALUES ($1, $2)
       RETURNING *;`,
      [id, cleanAlias]
    );

    // Re-link invoices that match this new alias
    await client.query(`
      UPDATE invoice_records
      SET biller_id = $1
      WHERE UPPER(biller_raw_name) = $2;
    `, [id, cleanAlias]);

    await client.query('COMMIT');
    res.status(201).json({ alias: resAlias.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(400).json({ error: `El alias "${cleanAlias}" ya está registrado para otro facturador.` });
      return;
    }
    res.status(500).json({ error: 'Error al agregar alias.', details: err.message });
  } finally {
    client.release();
  }
});

// Remove alias
apiRouter.delete('/billers/aliases/:aliasId', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { aliasId } = req.params;
  try {
    await pool.query('DELETE FROM biller_aliases WHERE id = $1', [aliasId]);
    res.json({ message: 'Alias removido con éxito.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al eliminar alias.', details: err.message });
  }
});

// Get unmapped billers found in invoices
apiRouter.get('/billers/unmapped', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        biller_raw_name,
        COUNT(*) as count,
        json_agg(DISTINCT eps_folder) as eps_list
      FROM invoice_records
      WHERE biller_id IS NULL AND biller_raw_name IS NOT NULL
      GROUP BY biller_raw_name
      ORDER BY count DESC;
    `);
    res.json({ unmapped: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener facturadores no asignados.', details: err.message });
  }
});

// Re-link all unlinked invoices to billers based on all registered aliases
apiRouter.post('/billers/re-link', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`
      UPDATE invoice_records ir
      SET biller_id = ba.biller_id
      FROM biller_aliases ba
      WHERE UPPER(ir.biller_raw_name) = UPPER(ba.alias)
        AND (ir.biller_id IS NULL OR ir.biller_id != ba.biller_id);
    `);

    res.json({ message: 'Facturas sincronizadas con el catálogo de facturadores y alias.', updatedCount: result.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al sincronizar facturas con facturadores.', details: err.message });
  }
});

// ==========================================
// 4. INVOICES & JSON UPLOAD (PERSISTENCE)
// ==========================================
apiRouter.get('/invoices', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const search = (req.query.search as string || '').trim();
    const eps = (req.query.eps as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const billerId = req.query.biller_id ? parseInt(req.query.biller_id as string) : null;
    const batchId = req.query.batch_id ? parseInt(req.query.batch_id as string) : null;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(ir.invoice_number ILIKE $${paramIndex} OR ir.patient_name ILIKE $${paramIndex} OR ir.contract_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (eps) {
      conditions.push(`ir.eps_folder = $${paramIndex}`);
      params.push(eps);
      paramIndex++;
    }

    if (status) {
      conditions.push(`ir.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (billerId) {
      conditions.push(`ir.biller_id = $${paramIndex}`);
      params.push(billerId);
      paramIndex++;
    }

    if (batchId) {
      conditions.push(`ir.batch_id = $${paramIndex}`);
      params.push(batchId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countRes = await pool.query(`SELECT COUNT(*) FROM invoice_records ir ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    // Records
    const query = `
      SELECT 
        ir.id,
        ir.batch_id,
        ir.patient_name,
        ir.eps_folder,
        ir.biller_raw_name,
        ir.biller_id,
        b.display_name as biller_display_name,
        b.name as biller_system_name,
        b.phone as biller_phone,
        ir.folder_path,
        ir.base_path,
        ir.subfolder_patient,
        ir.invoice_number,
        ir.invoice_date,
        ir.regimen,
        ir.contract_id,
        ir.contract_name,
        ir.files_to_upload,
        ir.status,
        ir.error_reason,
        ir.return_note,
        ir.whatsapp_notified_at,
        ir.created_at,
        ir.updated_at
      FROM invoice_records ir
      LEFT JOIN billers b ON ir.biller_id = b.id
      ${whereClause}
      ORDER BY ir.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const recordsRes = await pool.query(query, [...params, limit, offset]);

    // Unique EPS and Status for filters
    const epsListRes = await pool.query('SELECT DISTINCT eps_folder FROM invoice_records ORDER BY eps_folder;');
    const statusListRes = await pool.query('SELECT DISTINCT status FROM invoice_records ORDER BY status;');

    res.json({
      items: recordsRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      availableFilters: {
        eps: epsListRes.rows.map(r => r.eps_folder),
        statuses: statusListRes.rows.map(r => r.status),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar facturas.', details: err.message });
  }
});

// Upload JSON payload
apiRouter.post('/invoices/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const payload = req.body;
  let items: any[] = [];
  const filename = req.query.filename as string || req.body.filename || `Carga_Lote_${new Date().toISOString().slice(0, 10)}.json`;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.items)) {
    items = payload.items;
  } else if (payload && payload.invoice_number) {
    items = [payload];
  } else {
    res.status(400).json({ error: 'Formato JSON inválido. Se espera un array de registros o un objeto válido.' });
    return;
  }

  if (items.length === 0) {
    res.status(400).json({ error: 'El archivo JSON no contiene registros para procesar.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create upload batch
    const duplicatesCount = items.filter(i => (i.status || '').toUpperCase() === 'DUPLICADO').length;
    const completedCount = items.filter(i => (i.status || '').toUpperCase() === 'COMPLETADO').length;

    const batchRes = await client.query(
      `INSERT INTO upload_batches (filename, total_records, duplicates_count, completed_count, uploaded_by_username)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [filename, items.length, duplicatesCount, completedCount, req.user?.username || 'sistema']
    );
    const batchId = batchRes.rows[0].id;

    // 2. Fetch existing aliases map
    const aliasRows = await client.query(`
      SELECT ba.alias, b.id as biller_id 
      FROM biller_aliases ba
      JOIN billers b ON ba.biller_id = b.id;
    `);
    const aliasMap = new Map<string, number>();
    for (const row of aliasRows.rows) {
      aliasMap.set(row.alias.trim().toUpperCase(), row.biller_id);
    }

    let inserted = 0;
    let updated = 0;
    const newBillersDetected = new Set<string>();

    for (const item of items) {
      if (!item.invoice_number || !item.folder_path) {
        continue;
      }

      const parsed = parseFolderPath(item.folder_path, item.eps_folder);
      const rawBillerUpper = parsed.billerRaw.toUpperCase();
      let resolvedBillerId = aliasMap.get(rawBillerUpper) || null;

      if (!resolvedBillerId && parsed.billerRaw && parsed.billerRaw !== 'DESCONOCIDO') {
        newBillersDetected.add(parsed.billerRaw);
      }

      const filesJson = JSON.stringify(item.files_to_upload || []);

      const insertRes = await client.query(
        `INSERT INTO invoice_records (
          batch_id, patient_name, eps_folder, biller_raw_name, biller_id,
          folder_path, base_path, subfolder_patient, invoice_number,
          invoice_date, regimen, contract_id, contract_name, files_to_upload,
          status, error_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (invoice_number, patient_name) DO UPDATE SET
          batch_id = EXCLUDED.batch_id,
          folder_path = EXCLUDED.folder_path,
          base_path = EXCLUDED.base_path,
          subfolder_patient = EXCLUDED.subfolder_patient,
          biller_raw_name = EXCLUDED.biller_raw_name,
          biller_id = COALESCE(EXCLUDED.biller_id, invoice_records.biller_id),
          status = EXCLUDED.status,
          error_reason = EXCLUDED.error_reason,
          files_to_upload = EXCLUDED.files_to_upload,
          updated_at = NOW()
        RETURNING (xmax = 0) AS was_inserted;`,
        [
          batchId,
          item.patient_name || parsed.patientFolder || 'SIN PACIENTE',
          item.eps_folder || parsed.eps,
          parsed.billerRaw,
          resolvedBillerId,
          item.folder_path,
          parsed.basePath,
          parsed.patientFolder,
          item.invoice_number,
          item.invoice_date || null,
          item.regimen || null,
          item.contract_id || null,
          item.contract_name || null,
          filesJson,
          item.status || 'PENDIENTE',
          item.error_reason || null,
        ]
      );

      if (insertRes.rows[0].was_inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      batchId,
      totalProcessed: items.length,
      inserted,
      updated,
      duplicatesCount,
      completedCount,
      newBillersDetected: Array.from(newBillersDetected),
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al persistir el JSON en la base de datos PostgreSQL.', details: err.message });
  } finally {
    client.release();
  }
});

// Single invoice detail
apiRouter.get('/invoices/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        ir.*,
        b.display_name as biller_display_name,
        b.phone as biller_phone,
        b.email as biller_email,
        ub.filename as batch_filename
       FROM invoice_records ir
       LEFT JOIN billers b ON ir.biller_id = b.id
       LEFT JOIN upload_batches ub ON ir.batch_id = ub.id
       WHERE ir.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }

    res.json({ invoice: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener la factura.', details: err.message });
  }
});

// Update Return Note ("Nota de Devolución") for invoice
apiRouter.put('/invoices/:id/return-note', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { return_note } = req.body;

  try {
    const cleanNote = typeof return_note === 'string' ? return_note.trim() : null;
    const result = await pool.query(
      `UPDATE invoice_records 
       SET return_note = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *;`,
      [cleanNote, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Factura no encontrada.' });
      return;
    }

    res.json({ success: true, invoice: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al actualizar la nota de devolución.', details: err.message });
  }
});

// Delete invoice (SuperAdmin / Admin)
apiRouter.delete('/invoices/:id', authenticateToken, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM invoice_records WHERE id = $1', [id]);
    res.json({ message: 'Registro de factura eliminado de la base de datos.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al eliminar factura.', details: err.message });
  }
});

// List upload batches
apiRouter.get('/batches', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM upload_batches ORDER BY created_at DESC LIMIT 50;
    `);
    res.json({ batches: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al listar lotes.', details: err.message });
  }
});

// ==========================================
// 5. VALIDADOR RIPS & WHATSAPP WEB CROSS-CHECK
// ==========================================
apiRouter.post('/rips/lookup', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { invoice_numbers } = req.body;

  let numbersList: string[] = [];

  if (Array.isArray(invoice_numbers)) {
    numbersList = invoice_numbers.map(n => String(n).trim().toUpperCase()).filter(Boolean);
  } else if (typeof invoice_numbers === 'string') {
    // Split by commas, newlines, semicolons or spaces
    numbersList = invoice_numbers
      .split(/[\r\n,;\s]+/)
      .map(n => n.trim().toUpperCase())
      .filter(n => n.length > 2);
  }

  // De-duplicate requested numbers
  const uniqueNumbers = Array.from(new Set(numbersList));

  if (uniqueNumbers.length === 0) {
    res.status(400).json({ error: 'Por favor proporcione al menos un número de factura para consultar.' });
    return;
  }

  try {
    const query = `
      SELECT 
        ir.id,
        ir.invoice_number,
        ir.patient_name,
        ir.eps_folder,
        ir.biller_raw_name,
        ir.biller_id,
        b.display_name as biller_display_name,
        b.name as biller_name,
        b.phone as biller_phone,
        b.email as biller_email,
        ir.folder_path,
        ir.base_path,
        ir.subfolder_patient,
        ir.invoice_date,
        ir.regimen,
        ir.contract_name,
        ir.status,
        ir.error_reason,
        ir.return_note,
        ir.files_to_upload,
        ir.whatsapp_notified_at
      FROM invoice_records ir
      LEFT JOIN billers b ON ir.biller_id = b.id
      WHERE UPPER(ir.invoice_number) = ANY($1);
    `;

    const result = await pool.query(query, [uniqueNumbers]);
    const foundRecords = result.rows;

    const foundNumbersSet = new Set(foundRecords.map(r => r.invoice_number.toUpperCase()));
    const missingNumbers = uniqueNumbers.filter(n => !foundNumbersSet.has(n));

    // Group found invoices by biller so user can send one consolidated WhatsApp per biller or individually
    const groupedByBiller: Record<string, {
      billerName: string;
      billerPhone: string | null;
      invoices: any[];
    }> = {};

    for (const inv of foundRecords) {
      const key = inv.biller_display_name || inv.biller_name || inv.biller_raw_name || 'SIN ASIGNAR';
      if (!groupedByBiller[key]) {
        groupedByBiller[key] = {
          billerName: key,
          billerPhone: inv.biller_phone,
          invoices: [],
        };
      }
      groupedByBiller[key].invoices.push(inv);
    }

    res.json({
      searchedCount: uniqueNumbers.length,
      foundCount: foundRecords.length,
      missingCount: missingNumbers.length,
      records: foundRecords,
      missingNumbers,
      groupedByBiller: Object.values(groupedByBiller),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar validador RIPS en la base de datos.', details: err.message });
  }
});

// Mark WhatsApp notified
apiRouter.post('/rips/notify-whatsapp', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { invoice_id, invoice_ids } = req.body;
  const ids: number[] = [];

  if (invoice_id) ids.push(Number(invoice_id));
  if (Array.isArray(invoice_ids)) {
    ids.push(...invoice_ids.map(Number));
  }

  if (ids.length === 0) {
    res.status(400).json({ error: 'Se requiere invoice_id o invoice_ids.' });
    return;
  }

  try {
    await pool.query(
      `UPDATE invoice_records SET whatsapp_notified_at = NOW() WHERE id = ANY($1);`,
      [ids]
    );

    res.json({ success: true, notifiedCount: ids.length, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al registrar notificación WhatsApp.', details: err.message });
  }
});

// ==========================================
// 6. DASHBOARD STATISTICS
// ==========================================
apiRouter.get('/stats', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Overall counts
    const generalRes = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'DUPLICADO') as total_duplicates,
        COUNT(*) FILTER (WHERE status = 'COMPLETADO') as total_completed,
        COUNT(*) FILTER (WHERE whatsapp_notified_at IS NOT NULL) as total_notified,
        COUNT(DISTINCT patient_name) as total_patients
      FROM invoice_records;
    `);

    // 2. Count by EPS
    const epsRes = await pool.query(`
      SELECT 
        eps_folder, 
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'DUPLICADO') as duplicates,
        COUNT(*) FILTER (WHERE status = 'COMPLETADO') as completed
      FROM invoice_records
      GROUP BY eps_folder
      ORDER BY count DESC;
    `);

    // 3. Count by Facturador
    const billerRes = await pool.query(`
      SELECT 
        COALESCE(b.display_name, ir.biller_raw_name, 'Sin Asignar') as biller_name,
        b.phone as biller_phone,
        COUNT(ir.id) as count,
        COUNT(ir.id) FILTER (WHERE ir.status = 'DUPLICADO') as duplicates,
        COUNT(ir.id) FILTER (WHERE ir.status = 'COMPLETADO') as completed
      FROM invoice_records ir
      LEFT JOIN billers b ON ir.biller_id = b.id
      GROUP BY COALESCE(b.display_name, ir.biller_raw_name, 'Sin Asignar'), b.phone
      ORDER BY count DESC;
    `);

    // 4. Recent batches
    const batchesRes = await pool.query(`
      SELECT id, filename, total_records, duplicates_count, completed_count, created_at, uploaded_by_username
      FROM upload_batches
      ORDER BY created_at DESC LIMIT 5;
    `);

    res.json({
      summary: generalRes.rows[0],
      byEps: epsRes.rows,
      byBiller: billerRes.rows,
      recentBatches: batchesRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al calcular estadísticas.', details: err.message });
  }
});
