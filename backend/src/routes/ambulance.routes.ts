import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Simulated city locations around hospital (Bangalore coordinates base ~12.9716, 77.5946)
const SIMULATED_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Hospital Main Emergency Bay': { lat: 12.9716, lng: 77.5946 },
  'Indiranagar 100ft Road': { lat: 12.9784, lng: 77.6408 },
  'Koramangala 5th Block': { lat: 12.9352, lng: 77.6245 },
  'Outer Ring Road (Silk Board Junction)': { lat: 12.9172, lng: 77.6228 },
  'MG Road Metro Station': { lat: 12.9756, lng: 77.6066 },
  'Whitefield ITPL Main Road': { lat: 12.9863, lng: 77.7314 },
  'Hebbal Flyover Expressway': { lat: 13.0358, lng: 77.5970 },
  'Jayanagar 4th Block': { lat: 12.9299, lng: 77.5824 },
  'HSR Layout Sector 2': { lat: 12.9121, lng: 77.6446 },
};

// 1. List all ambulances
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ambulances = db.prepare(`
      SELECT a.*,
        (SELECT aa.pickup_location FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_destination,
        (SELECT aa.caller_name FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_caller,
        (SELECT aa.caller_phone FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_phone,
        (SELECT aa.id FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_assignment_id
      FROM ambulances a
      ORDER BY a.id ASC
    `).all();

    res.json({ ambulances });
  } catch (err: any) {
    console.error('List ambulances error:', err);
    res.status(500).json({ error: 'Failed to retrieve ambulances.' });
  }
});

// 2. Register new ambulance
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      vehicle_number,
      ambulance_type,
      driver_name,
      driver_phone,
      paramedic_name,
      paramedic_phone,
      base_station,
    } = req.body;

    if (!vehicle_number || !ambulance_type || !driver_name || !driver_phone) {
      return res.status(400).json({ error: 'Vehicle number, ambulance type, driver name, and driver phone are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO ambulances (
        vehicle_number, ambulance_type, driver_name, driver_phone,
        paramedic_name, paramedic_phone, status, base_station, current_location_name, current_latitude, current_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, 'Available', ?, 'Hospital Main Emergency Bay', 12.9716, 77.5946)
    `);

    const result = stmt.run(
      vehicle_number.toUpperCase().trim(),
      ambulance_type,
      driver_name.trim(),
      driver_phone.trim(),
      paramedic_name ? paramedic_name.trim() : null,
      paramedic_phone ? paramedic_phone.trim() : null,
      base_station ? base_station.trim() : 'Main Emergency Wing'
    );

    const created = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Ambulance registered successfully', ambulance: created });
  } catch (err: any) {
    console.error('Register ambulance error:', err);
    res.status(500).json({ error: 'Failed to register ambulance.' });
  }
});

// 3. Dispatch Ambulance for an Emergency Request
router.post('/dispatch', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      ambulance_id,
      emergency_case_id,
      pickup_location,
      caller_name,
      caller_phone,
      notes,
    } = req.body;

    if (!ambulance_id || !pickup_location) {
      return res.status(400).json({ error: 'Ambulance ID and pickup location are required.' });
    }

    const amb = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(ambulance_id) as any;
    if (!amb) {
      return res.status(404).json({ error: 'Ambulance not found.' });
    }
    if (amb.status !== 'Available') {
      return res.status(409).json({ error: `Ambulance ${amb.vehicle_number} is currently ${amb.status}.` });
    }

    // Pick simulated coordinates for the location
    const coords = SIMULATED_COORDINATES[pickup_location] || {
      lat: 12.9716 + (Math.random() - 0.5) * 0.08,
      lng: 77.5946 + (Math.random() - 0.5) * 0.08,
    };

    // Create assignment
    const assignStmt = db.prepare(`
      INSERT INTO ambulance_assignments (
        ambulance_id, emergency_case_id, pickup_location, pickup_latitude, pickup_longitude,
        caller_name, caller_phone, assigned_by_user_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Dispatched', ?)
    `);

    const assignRes = assignStmt.run(
      ambulance_id,
      emergency_case_id || null,
      pickup_location,
      coords.lat,
      coords.lng,
      caller_name || null,
      caller_phone || null,
      req.user?.id || null,
      notes || null
    );

    // Update ambulance status
    db.prepare(`
      UPDATE ambulances
      SET status = 'Dispatched',
          current_emergency_case_id = ?,
          current_location_name = ?
      WHERE id = ?
    `).run(emergency_case_id || null, `En route to ${pickup_location}`, ambulance_id);

    // If linked to emergency case, log in case history
    if (emergency_case_id) {
      db.prepare(`
        INSERT INTO emergency_activity_logs (
          emergency_case_id, action_type, performed_by_user_id, performed_by_name, details
        ) VALUES (?, 'AMBULANCE_LINKED', ?, ?, ?)
      `).run(
        emergency_case_id,
        req.user?.id || null,
        req.user?.full_name || 'EMS Dispatch',
        `Ambulance ${amb.vehicle_number} dispatched for patient pickup at ${pickup_location}. Driver: ${amb.driver_name}.`
      );
    }

    res.status(201).json({
      message: `Ambulance ${amb.vehicle_number} dispatched successfully`,
      assignment_id: Number(assignRes.lastInsertRowid),
    });
  } catch (err: any) {
    console.error('Dispatch ambulance error:', err);
    res.status(500).json({ error: 'Failed to dispatch ambulance.' });
  }
});

// 4. Update Ambulance Workflow Status (Dispatched -> On the Way -> Arrived -> Returning -> Available)
router.patch('/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, simulated_location_name } = req.body;

    const validStatuses = ['Available', 'Dispatched', 'On the Way', 'Arrived', 'Returning', 'Under Maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid ambulance status.' });
    }

    const amb = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(id) as any;
    if (!amb) {
      return res.status(404).json({ error: 'Ambulance not found.' });
    }

    // Find active assignment
    const activeAssignment = db.prepare(`
      SELECT * FROM ambulance_assignments
      WHERE ambulance_id = ? AND status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning')
      ORDER BY id DESC LIMIT 1
    `).get(id) as any;

    let newLocation = simulated_location_name || amb.current_location_name;
    let lat = amb.current_latitude;
    let lng = amb.current_longitude;

    if (status === 'Available') {
      newLocation = 'Hospital Main Emergency Bay';
      lat = 12.9716;
      lng = 77.5946;
    }

    // Update active assignment timestamps if applicable
    if (activeAssignment) {
      if (status === 'On the Way') {
        db.prepare("UPDATE ambulance_assignments SET status = 'On the Way', on_the_way_at = datetime('now') WHERE id = ?").run(activeAssignment.id);
      } else if (status === 'Arrived') {
        db.prepare("UPDATE ambulance_assignments SET status = 'Arrived', arrived_at_scene_at = datetime('now') WHERE id = ?").run(activeAssignment.id);
      } else if (status === 'Returning') {
        db.prepare("UPDATE ambulance_assignments SET status = 'Returning', patient_handover_at = datetime('now') WHERE id = ?").run(activeAssignment.id);
      } else if (status === 'Available') {
        db.prepare("UPDATE ambulance_assignments SET status = 'Completed', returned_to_base_at = datetime('now') WHERE id = ?").run(activeAssignment.id);
      }
    }

    // Update ambulance
    db.prepare(`
      UPDATE ambulances
      SET status = ?,
          current_location_name = ?,
          current_latitude = ?,
          current_longitude = ?,
          current_emergency_case_id = CASE WHEN ? = 'Available' THEN null ELSE current_emergency_case_id END
      WHERE id = ?
    `).run(status, newLocation, lat, lng, status, id);

    const updated = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(id);
    res.json({ message: `Ambulance status updated to ${status}`, ambulance: updated });
  } catch (err: any) {
    console.error('Update ambulance status error:', err);
    res.status(500).json({ error: 'Failed to update ambulance status.' });
  }
});

// 5. Get Ambulance Assignment History
router.get('/:id/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const assignments = db.prepare(`
      SELECT aa.*, e.case_code, p.full_name as patient_name
      FROM ambulance_assignments aa
      LEFT JOIN emergency_cases e ON aa.emergency_case_id = e.id
      LEFT JOIN patients p ON e.patient_id = p.id
      WHERE aa.ambulance_id = ?
      ORDER BY aa.id DESC
    `).all(id);

    res.json({ assignments });
  } catch (err: any) {
    console.error('Get ambulance history error:', err);
    res.status(500).json({ error: 'Failed to retrieve ambulance assignments.' });
  }
});

export default router;

