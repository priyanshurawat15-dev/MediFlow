#!/usr/bin/env python
import sys
from app import create_app

if __name__ == '__main__':
    # Optional command-line argument to seed the database
    if '--seed' in sys.argv:
        from app.database.seed import seed_all
        seed_all()
    app = create_app()
    app.run(host='0.0.0.0', port=app.config.get('PORT', 5000), debug=app.config.get('DEBUG', False))

