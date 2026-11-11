import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/analytics', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Emergency cases by priority
    const priorityData = db.prepare(`
      SELECT triage_priority as name, COUNT(*) as count
      FROM emergency_cases
      GROUP BY triage_priority
      ORDER BY 
        CASE 
          WHEN triage_priority = 'Critical' THEN 1
          WHEN triage_priority = 'High' THEN 2
          WHEN triage_priority = 'Medium' THEN 3
          ELSE 4
        END ASC
    `).all();

    // 2. Emergency cases by status
    const statusData = db.prepare(`
      SELECT status as name, COUNT(*) as count
      FROM emergency_cases
      GROUP BY status
    `).all();

    // 3. Bed occupancy by category
    const bedCategories = ['Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room'];
    const bedOccupancyData = bedCategories.map((category) => {
      const total = (db.prepare('SELECT COUNT(*) as count FROM beds WHERE category = ?').get(category) as any).count;
      const occupied = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Occupied'").get(category) as any).count;
      const available = total - occupied;
      const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
      return {
        category,
        total,
        occupied,
        available,
        occupancyRate,
      };
    });

    // 4. Ambulance Fleet Status
    const ambulanceData = db.prepare(`
      SELECT status as name, COUNT(*) as count
      FROM ambulances
      GROUP BY status
    `).all();

    // 5. Emergency Types Breakdown
    const emergencyTypes = db.prepare(`
      SELECT emergency_type as name, COUNT(*) as count
      FROM emergency_cases
      GROUP BY emergency_type
      ORDER BY count DESC
      LIMIT 6
    `).all();

    // 6. Average Response Time calculation (Minutes)
    // From arrived_at to assigned_at
    const responseTimes = db.prepare(`
      SELECT arrived_at, assigned_at
      FROM emergency_cases
      WHERE assigned_at IS NOT NULL
    `).all() as any[];

    let totalWaitMins = 0;
    responseTimes.forEach((r) => {
      const diff = Math.max(0, (new Date(r.assigned_at).getTime() - new Date(r.arrived_at).getTime()) / (1000 * 60));
      totalWaitMins += diff;
    });
    const avgResponseTimeMinutes = responseTimes.length > 0 ? Math.round((totalWaitMins / responseTimes.length) * 10) / 10 : 8.5;

    // 7. Summary Counters
    const totalPatients = (db.prepare('SELECT COUNT(*) as count FROM patients').get() as any).count;
    const totalEmergencies = (db.prepare('SELECT COUNT(*) as count FROM emergency_cases').get() as any).count;
    const totalBeds = (db.prepare('SELECT COUNT(*) as count FROM beds').get() as any).count;
    const occupiedBeds = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'").get() as any).count;
    const overallBedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    res.json({
      summary: {
        totalPatients,
        totalEmergencies,
        avgResponseTimeMinutes,
        overallBedOccupancyRate,
        totalBeds,
        occupiedBeds,
      },
      priorityData,
      statusData,
      bedOccupancyData,
      ambulanceData,
      emergencyTypes,
    });
  } catch (err: any) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics.' });
  }
});

export default router;

