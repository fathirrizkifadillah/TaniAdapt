import { getPgPool, ensureDbSchema, parseReqBody } from './dbHelper';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await ensureDbSchema();
    const pool = getPgPool();

    // GET /api/plots
    if (req.method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const userId = urlObj.searchParams.get('user_id');
      let plotsQuery = 'SELECT * FROM plots ORDER BY updated_at DESC';
      let params: any[] = [];
      if (userId) {
        plotsQuery = 'SELECT * FROM plots WHERE user_id = $1 ORDER BY updated_at DESC';
        params = [parseInt(userId, 10)];
      }
      const qRes = await pool.query(plotsQuery, params);
      const plots = qRes.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        locationId: r.location_id,
        placeName: r.place_name,
        cropId: r.crop_id,
        plantDate: r.plant_date,
        hst: r.hst,
        stageName: r.stage_name,
        risk: r.risk,
        areaHa: r.area_ha,
        trail: r.trail || [],
        updatedAt: r.updated_at,
      }));
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, plots }));
    }

    // POST /api/plots
    if (req.method === 'POST') {
      const body = await parseReqBody(req);
      const { plot, user_id } = body;
      if (!plot || !plot.name) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Data petak lahan wajib diisi.' }));
      }
      const plotId = plot.id || `plot-${Date.now().toString(36)}`;
      const plantDate = plot.plantDate || new Date().toISOString().split('T')[0];

      await pool.query(
        `INSERT INTO plots (id, user_id, name, location_id, place_name, crop_id, plant_date, hst, stage_name, risk, area_ha, trail, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           location_id = EXCLUDED.location_id,
           place_name = EXCLUDED.place_name,
           crop_id = EXCLUDED.crop_id,
           plant_date = EXCLUDED.plant_date,
           hst = EXCLUDED.hst,
           stage_name = EXCLUDED.stage_name,
           risk = EXCLUDED.risk,
           area_ha = EXCLUDED.area_ha,
           trail = EXCLUDED.trail,
           updated_at = NOW()`,
        [
          plotId,
          user_id || null,
          plot.name,
          plot.locationId || 'loc-lembang',
          plot.placeName || 'Lembang, Jawa Barat',
          plot.cropId || 'cabai',
          plantDate,
          plot.hst || 0,
          plot.stageName || 'Vegetatif Awal',
          plot.risk || 'RENDAH',
          plot.areaHa || 1.0,
          JSON.stringify(plot.trail || []),
        ]
      );

      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, plot: { ...plot, id: plotId } }));
    }

    // DELETE /api/plots
    if (req.method === 'DELETE') {
      const body = await parseReqBody(req);
      const { id } = body;
      if (!id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'ID lahan wajib disertakan.' }));
      }
      await pool.query('DELETE FROM plots WHERE id = $1', [id]);
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, id }));
    }

    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
