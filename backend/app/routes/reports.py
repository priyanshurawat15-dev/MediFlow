from flask import Blueprint, jsonify
import datetime
from ..database.db import query_all
from ..middleware.auth import authenticate

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@reports_bp.route('/analytics', methods=['GET'])
@authenticate
def analytics():
    """Provide analytics data similar to original Node version."""
    # 1. Emergency cases by priority
    priority_data = query_all('''
        SELECT triage_priority as name, COUNT(*) as count
        FROM emergency_cases
        GROUP BY triage_priority
        ORDER BY CASE 
            WHEN triage_priority = 'Critical' THEN 1
            WHEN triage_priority = 'High' THEN 2
            WHEN triage_priority = 'Medium' THEN 3
            ELSE 4
        END ASC
    ''')

    # 2. Emergency cases by status
    status_data = query_all('''
        SELECT status as name, COUNT(*) as count
        FROM emergency_cases
        GROUP BY status
    ''')

    # 3. Bed occupancy by category
    categories = ['Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room']
    bed_occupancy_data = []
    for cat in categories:
        total = query_all('SELECT COUNT(*) as count FROM beds WHERE category = ?', (cat,))[0]['count']
        occupied = query_all("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Occupied'", (cat,))[0]['count']
        available = total - occupied
        occupancy_rate = round((occupied / total) * 100) if total > 0 else 0
        bed_occupancy_data.append({
            'category': cat,
            'total': total,
            'occupied': occupied,
            'available': available,
            'occupancyRate': occupancy_rate,
        })

    # 4. Ambulance fleet status
    ambulance_data = query_all('''
        SELECT status as name, COUNT(*) as count
        FROM ambulances
        GROUP BY status
    ''')

    # 5. Emergency types breakdown (top 6)
    emergency_types = query_all('''
        SELECT emergency_type as name, COUNT(*) as count
        FROM emergency_cases
        GROUP BY emergency_type
        ORDER BY count DESC
        LIMIT 6
    ''')

    # 6. Average response time (minutes) from arrived_at to assigned_at
    response_rows = query_all('''
        SELECT arrived_at, assigned_at
        FROM emergency_cases
        WHERE assigned_at IS NOT NULL
    ''')
    total_minutes = 0
    for r in response_rows:
        try:
            arrived = r['arrived_at']
            assigned = r['assigned_at']
            diff = (datetime.datetime.fromisoformat(assigned) - datetime.datetime.fromisoformat(arrived)).total_seconds() / 60
            total_minutes += max(0, diff)
        except Exception:
            continue
    avg_response = round(total_minutes / len(response_rows), 1) if response_rows else 0

    # 7. Summary counters
    total_patients = query_all('SELECT COUNT(*) as count FROM patients')[0]['count']
    total_emergencies = query_all('SELECT COUNT(*) as count FROM emergency_cases')[0]['count']
    total_beds = query_all('SELECT COUNT(*) as count FROM beds')[0]['count']
    occupied_beds = query_all("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'")[0]['count']

    return jsonify({
        'summary': {
            'totalPatients': total_patients,
            'totalEmergencies': total_emergencies,
            'totalBeds': total_beds,
            'occupiedBeds': occupied_beds,
            'overallBedOccupancyRate': round((occupied_beds / total_beds) * 100) if total_beds else 0,
            'averageResponseTimeMinutes': avg_response,
        },
        'priorityData': priority_data,
        'statusData': status_data,
        'bedOccupancyData': bed_occupancy_data,
        'ambulanceData': ambulance_data,
        'emergencyTypes': emergency_types,
    })
