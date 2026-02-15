from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import func

db = SQLAlchemy()

class Receipt(db.Model):
    """Receipt model for storing receipt information"""
    __tablename__ = 'receipts'
    
    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.String(50), unique=True, nullable=False)
    store_name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text)
    phone_number = db.Column(db.String(20))
    transaction_trn = db.Column(db.String(50))  # Tax Registration Number
    
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time)
    customer_name = db.Column(db.String(200))
    
    total_excl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    total_incl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    vat_rate = db.Column(db.Numeric(5, 2), default=5.0)
    vat_amount = db.Column(db.Numeric(10, 2))
    
    payment_method = db.Column(db.String(50))  # Cash, Card, etc.
    refund_policy = db.Column(db.Text)
    barcode = db.Column(db.String(50))
    
    category = db.Column(db.String(50), default='Other')
    notes = db.Column(db.Text)
    
    # Receipt image path
    image_path = db.Column(db.String(500))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('ReceiptItem', backref='receipt', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert receipt to dictionary"""
        return {
            'id': self.id,
            'receipt_id': self.receipt_id,
            'store_name': self.store_name,
            'address': self.address,
            'phone_number': self.phone_number,
            'transaction_trn': self.transaction_trn,
            'date': self.date.isoformat() if self.date else None,
            'time': self.time.isoformat() if self.time else None,
            'customer_name': self.customer_name,
            'total_excl_vat': float(self.total_excl_vat) if self.total_excl_vat else 0,
            'total_incl_vat': float(self.total_incl_vat) if self.total_incl_vat else 0,
            'vat_rate': float(self.vat_rate) if self.vat_rate else 0,
            'vat_amount': float(self.vat_amount) if self.vat_amount else 0,
            'payment_method': self.payment_method,
            'refund_policy': self.refund_policy,
            'barcode': self.barcode,
            'category': self.category,
            'notes': self.notes,
            'image_path': self.image_path,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'items': [item.to_dict() for item in self.items]
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
        return {
            'id': self.id,
            'receipt_id': self.receipt_id,
            'item_name': self.item_name,
            'quantity': self.quantity,
            'price': float(self.price) if self.price else 0,
            'category': self.category,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Budget(db.Model):
    """Budget model for tracking monthly budgets by category"""
    __tablename__ = 'budgets'
    
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)
    monthly_limit = db.Column(db.Numeric(10, 2), nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    year = db.Column(db.Integer, nullable=False)
    
    alert_threshold = db.Column(db.Numeric(5, 2), default=80.0)  # Alert at 80% of budget
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert budget to dictionary"""
        return {
            'id': self.id,
            'category': self.category,
            'monthly_limit': float(self.monthly_limit) if self.monthly_limit else 0,
            'month': self.month,
            'year': self.year,
            'alert_threshold': float(self.alert_threshold) if self.alert_threshold else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class User(db.Model):
    """User model for future multi-user support"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    name = db.Column(db.String(200))
    password_hash = db.Column(db.String(200))
    
    preferred_currency = db.Column(db.String(3), default='AED')
    preferred_language = db.Column(db.String(2), default='en')  # en or ar
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'preferred_currency': self.preferred_currency,
            'preferred_language': self.preferred_language,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
