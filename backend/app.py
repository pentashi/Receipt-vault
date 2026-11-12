from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

from config import Config
from models import db
from routes.receipts import receipts_bp
from routes.expenses import expenses_bp
from routes.auth import auth_bp
from routes.companies import companies_bp
from routes.vat import vat_bp

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
jwt = JWTManager(app)

# db.create_all() doesn't add columns to existing tables, so new columns are added here.
SCHEMA_UPDATES = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'AED'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'en'",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'AED'",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 6) DEFAULT 1.0",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS address TEXT",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS transaction_trn VARCHAR(50)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS refund_policy TEXT",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS barcode VARCHAR(50)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_extraction JSONB",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS time TIME",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS review_note TEXT",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id)",
    "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP",
    "ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS category VARCHAR(50)",
    "ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
    "CREATE INDEX IF NOT EXISTS ix_receipts_company_date ON receipts (company_id, date)",
]

# Every pre-company user gets their own company; their receipts move into it.
BACKFILL = [
    """INSERT INTO companies (name, emirate, vat_quarter_start_month, is_demo, created_at, updated_at)
       SELECT 'user:' || u.id, 'Dubai', 1, COALESCE(u.is_guest, FALSE), NOW(), NOW()
       FROM users u WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)""",
    """INSERT INTO memberships (user_id, company_id, role, created_at)
       SELECT CAST(SUBSTRING(c.name FROM 6) AS INTEGER), c.id, 'owner', NOW()
       FROM companies c WHERE c.name LIKE 'user:%'""",
    """UPDATE companies c SET name = COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) || '''s Business'
       FROM users u WHERE c.name = 'user:' || u.id""",
    """UPDATE receipts r SET company_id = m.company_id
       FROM memberships m WHERE r.company_id IS NULL AND m.user_id = r.user_id AND m.role = 'owner'""",
    "UPDATE receipts SET status = 'approved' WHERE status IS NULL",
    "UPDATE receipts SET category = 'Meals & Entertainment' WHERE category = 'Dining & Food'",
    "UPDATE receipts SET category = 'Transport & Travel' WHERE category = 'Transport (Taxi/Metro)'",
    "UPDATE receipts SET category = 'Fuel & Vehicle' WHERE category = 'Fuel (Petrol)'",
    "UPDATE receipts SET category = 'Telecom & Internet' WHERE category = 'Mobile & Telecom'",
    "UPDATE receipts SET category = 'IT, Software & Equipment' WHERE category = 'Electronics'",
    "UPDATE receipts SET category = 'Rent & Facilities' WHERE category = 'Housing & Rent'",
    "UPDATE receipts SET category = 'Government & Licensing' WHERE category = 'Government Fees'",
    """UPDATE receipts SET category = 'Other' WHERE category IN
       ('Groceries', 'Healthcare (Pharmacy)', 'Shopping & Fashion', 'Entertainment', 'Education')""",
]


def migrate_database():
    with app.app_context():
        db.create_all()
        for statement in SCHEMA_UPDATES + BACKFILL:
            try:
                db.session.execute(text(statement))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"Migration step skipped: {str(e).splitlines()[0]}")


migrate_database()

app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
app.register_blueprint(companies_bp, url_prefix='/api/v1/companies')
app.register_blueprint(receipts_bp, url_prefix='/api/v1/receipts')
app.register_blueprint(expenses_bp, url_prefix='/api/v1/expenses')
app.register_blueprint(vat_bp, url_prefix='/api/v1/vat')

CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route('/')
def index():
    return jsonify({'message': 'ReceiptVault API', 'version': '2.0.0', 'status': 'running'})


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
