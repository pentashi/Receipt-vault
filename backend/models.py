from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Receipt(db.Model):
    """Receipt model for storing receipt information"""
    __tablename__ = 'receipts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receipt_id = db.Column(db.String(50), unique=True, nullable=False)
    store_name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text)
    phone_number = db.Column(db.String(20))
    transaction_trn = db.Column(db.String(50))  # Tax Registration Number
    
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time)
    customer_name = db.Column(db.String(200))
    
    # Currency Support (16K Engineer Level)
    currency = db.Column(db.String(3), default='AED')
    exchange_rate = db.Column(db.Numeric(10, 6), default=1.0) # Rate to AED
    original_amount = db.Column(db.Numeric(10, 2))
    
    total_excl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    total_incl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    vat_rate = db.Column(db.Numeric(5, 2), default=5.0)
    vat_amount = db.Column(db.Numeric(10, 2))
    
    payment_method = db.Column(db.String(50))  # Cash, Card, etc.
    refund_policy = db.Column(db.Text)
    barcode = db.Column(db.String(50))
    
    category = db.Column(db.String(50), default='Other')
    notes = db.Column(db.Text)
    raw_extraction = db.Column(JSONB)
    
    # Receipt image path
    image_path = db.Column(db.String(500))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('ReceiptItem', backref='receipt', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert receipt to dictionary"""
        try:
            return {
                'id': self.id,
                'user_id': self.user_id,
                'receipt_id': self.receipt_id,
                'store_name': self.store_name,
                'address': self.address,
                'phone_number': self.phone_number,
                'transaction_trn': self.transaction_trn,
                'date': self.date.isoformat() if self.date and hasattr(self.date, 'isoformat') else str(self.date) if self.date else None,
                'time': self.time.isoformat() if self.time and hasattr(self.time, 'isoformat') else str(self.time) if self.time else None,
                'customer_name': self.customer_name,
                'currency': self.currency or 'AED',
                'exchange_rate': float(self.exchange_rate) if self.exchange_rate is not None else 1.0,
                'original_amount': float(self.original_amount) if self.original_amount is not None else float(self.total_incl_vat) if self.total_incl_vat is not None else 0.0,
                'total_excl_vat': float(self.total_excl_vat) if self.total_excl_vat is not None else 0.0,
                'total_incl_vat': float(self.total_incl_vat) if self.total_incl_vat is not None else 0.0,
                'vat_rate': float(self.vat_rate) if self.vat_rate is not None else 5.0,
                'vat_amount': float(self.vat_amount) if self.vat_amount is not None else 0.0,
                'payment_method': self.payment_method or 'Unknown',
                'refund_policy': self.refund_policy,
                'barcode': self.barcode,
                'category': self.category or 'Other',
                'notes': self.notes,
                'image_path': self.image_path,
                'raw_extraction': self.raw_extraction,
                'created_at': self.created_at.isoformat() if self.created_at and hasattr(self.created_at, 'isoformat') else None,
                'updated_at': self.updated_at.isoformat() if self.updated_at and hasattr(self.updated_at, 'isoformat') else None,
                'items': [item.to_dict() for item in self.items] if self.items else []
            }
        except Exception as e:
            print(f"Serialization error for receipt {self.id}: {str(e)}")
            # Return a minimal dictionary if full serialization fails
            return {
                'id': self.id,
                'receipt_id': self.receipt_id,
                'store_name': self.store_name or "Error Loading",
                'error': 'Serialization error'
            }


class ReceiptItem(db.Model):
    """Receipt items model for itemized purchases"""
    __tablename__ = 'receipt_items'
    
    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('receipts.id'), nullable=False)
    
    item_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    category = db.Column(db.String(50))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert item to dictionary"""
        try:
            return {
                'id': self.id,
                'receipt_id': self.receipt_id,
                'item_name': self.item_name,
                'quantity': int(self.quantity) if self.quantity is not None else 1,
                'price': float(self.price) if self.price is not None else 0.0,
                'category': self.category,
                'created_at': self.created_at.isoformat() if self.created_at and hasattr(self.created_at, 'isoformat') else None
            }
        except Exception as e:
            return {'id': self.id, 'item_name': self.item_name, 'error': 'Serialization error'}


class Budget(db.Model):
    """Budget model for tracking monthly budgets by category"""
    __tablename__ = 'budgets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    monthly_limit = db.Column(db.Numeric(10, 2), nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    year = db.Column(db.Integer, nullable=False)
    
    alert_threshold = db.Column(db.Numeric(5, 2), default=80.0)  # Alert at 80% of budget
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert budget to dictionary"""
        try:
            return {
                'id': self.id,
                'user_id': self.user_id,
                'category': self.category,
                'monthly_limit': float(self.monthly_limit) if self.monthly_limit is not None else 0.0,
                'month': self.month,
                'year': self.year,
                'alert_threshold': float(self.alert_threshold) if self.alert_threshold is not None else 80.0,
                'created_at': self.created_at.isoformat() if self.created_at and hasattr(self.created_at, 'isoformat') else None,
                'updated_at': self.updated_at.isoformat() if self.updated_at and hasattr(self.updated_at, 'isoformat') else None
            }
        except Exception as e:
            return {'id': self.id, 'category': self.category, 'error': 'Serialization error'}


class User(db.Model):
    """User model for authentication and personalization"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    name = db.Column(db.String(200))
    password_hash = db.Column(db.String(200))
    is_guest = db.Column(db.Boolean, default=False)
    
    preferred_currency = db.Column(db.String(3), default='AED')
    preferred_language = db.Column(db.String(2), default='en')  # en or ar
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    receipts = db.relationship('Receipt', backref='user', lazy=True)
    budgets = db.relationship('Budget', backref='user', lazy=True)

    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if the provided password matches the hash"""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'is_guest': self.is_guest,
            'preferred_currency': self.preferred_currency,
            'preferred_language': self.preferred_language,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AuditLog(db.Model):
    """AuditLog model for immutable tracking of all changes (Compliance Section 4)"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False) # CREATE, UPDATE, DELETE
    resource_type = db.Column(db.String(50), nullable=False) # RECEIPT, BUDGET
    resource_id = db.Column(db.String(100))
    changes = db.Column(JSONB) # Before/After snapshot
    ip_address = db.Column(db.String(45))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'changes': self.changes,
            'created_at': self.created_at.isoformat()
        }
