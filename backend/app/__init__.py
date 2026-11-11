from flask import Flask
from flask_cors import CORS

from .config import Config
from .database.db import init_db, close_db
from .routes.auth import auth_bp
from .routes.dashboard import dashboard_bp
from .routes.patients import patients_bp
from .routes.doctors import doctors_bp
from .routes.beds import beds_bp
from .routes.appointments import appointments_bp
from .routes.ambulances import ambulances_bp
from .routes.emergency import emergency_bp
from .routes.billing import billing_bp
from .routes.reports import reports_bp
from .routes.staff import staff_bp

def create_app():
    """Application factory for MediFlow Flask backend."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for frontend development
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(patients_bp)
    app.register_blueprint(doctors_bp)
    app.register_blueprint(beds_bp)
    app.register_blueprint(appointments_bp)
    app.register_blueprint(ambulances_bp)
    app.register_blueprint(emergency_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(staff_bp)

    # Initialize database if not present
    @app.before_first_request
    def initialize_database():
        init_db()

    # Close DB connection on teardown
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        close_db()

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return {"status": "ok"}

    return app
