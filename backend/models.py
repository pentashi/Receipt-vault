from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from werkzeug.security import generate_password_hash, check_password_hash
import re

db = SQLAlchemy()

ROLES = ('owner', 'accountant', 'staff')
REVIEW_STATUSES = ('pending', 'approved', 'rejected')
TRN_PATTERN = re.compile(r'^\d{15}$')

# Input VAT on these is usually blocked under UAE VAT rules (e.g. business entertainment).
VAT_BLOCKED_CATEGORIES = {'Meals & Entertainment'}


def normalize_trn(value):
    if not value:
        return None
    digits = re.sub(r'\D', '', str(value))
    return digits or None


def is_valid_trn(value):
    trn = normalize_trn(value)
    return bool(trn and TRN_PATTERN.match(trn))


def _iso(value):
    return value.isoformat() if value is not None and hasattr(value, 'isoformat') else None


def _num(value, default=0.0):
    return float(value) if value is not None else default


class Company(db.Model):
    """A business workspace. All receipts belong to a company."""
    __tablename__ = 'companies'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    trn = db.Column(db.String(20))
    emirate = db.Column(db.String(50), default='Dubai')
    # First month of the company's VAT quarters (1 = Jan/Apr/Jul/Oct, 2 = Feb/May/Aug/Nov, 3 = Mar/Jun/Sep/Dec)
    vat_quarter_start_month = db.Column(db.Integer, default=1)
    is_demo = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = db.relationship('Membership', backref='company', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'trn': self.trn,
            'emirate': self.emirate,
            'vat_quarter_start_month': self.vat_quarter_start_month or 1,
            'is_demo': bool(self.is_demo),
            'created_at': _iso(self.created_at),
        }


class Membership(db.Model):
    __tablename__ = 'memberships'
    __table_args__ = (db.UniqueConstraint('user_id', 'company_id', name='uq_membership_user_company'),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'company': self.company.to_dict() if self.company else None,
            'user': self.user.to_dict() if self.user else None,
            'created_at': _iso(self.created_at),
        }


class Invite(db.Model):
    """Pending invite for someone who doesn't have an account yet; accepted on sign-up."""
    __tablename__ = 'invites'

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    email = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')
    invited_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    accepted_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    company = db.relationship('Company')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'created_at': _iso(self.created_at),
        }


class Receipt(db.Model):
    __tablename__ = 'receipts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # uploaded by
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'))
    receipt_id = db.Column(db.String(50), unique=True, nullable=False)
    store_name = db.Column(db.String(200), nullable=False)  # supplier
    address = db.Column(db.Text)
    phone_number = db.Column(db.String(20))
    transaction_trn = db.Column(db.String(50))  # supplier Tax Registration Number

    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time)
    customer_name = db.Column(db.String(200))

    currency = db.Column(db.String(3), default='AED')
    exchange_rate = db.Column(db.Numeric(10, 6), default=1.0)  # rate to AED
    original_amount = db.Column(db.Numeric(10, 2))

    total_excl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    total_incl_vat = db.Column(db.Numeric(10, 2), nullable=False)
    vat_rate = db.Column(db.Numeric(5, 2), default=5.0)
    vat_amount = db.Column(db.Numeric(10, 2))

    payment_method = db.Column(db.String(50))
    refund_policy = db.Column(db.Text)
    barcode = db.Column(db.String(50))

    category = db.Column(db.String(50), default='Other')
    notes = db.Column(db.Text)
    raw_extraction = db.Column(JSONB)

    status = db.Column(db.String(20), default='pending')
    review_note = db.Column(db.Text)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime)

    image_path = db.Column(db.String(500))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship('ReceiptItem', backref='receipt', lazy=True, cascade='all, delete-orphan')
    uploader = db.relationship('User', foreign_keys=[user_id])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    @property
    def trn_valid(self):
        return is_valid_trn(self.transaction_trn)

    @property
    def vat_issue(self):
        """Why the input VAT on this receipt can't be claimed, or None if it can."""
        if self.status == 'rejected':
            return 'rejected'
        if not self.vat_amount or float(self.vat_amount) <= 0:
            return 'no_vat'
        if not self.trn_valid:
            return 'missing_trn'
        if self.category in VAT_BLOCKED_CATEGORIES:
            return 'blocked_category'
        return None

    @property
    def vat_claimable(self):
        return self.vat_issue is None

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'company_id': self.company_id,
            'receipt_id': self.receipt_id,
            'store_name': self.store_name,
            'address': self.address,
            'phone_number': self.phone_number,
            'transaction_trn': self.transaction_trn,
            'trn_valid': self.trn_valid,
            'date': _iso(self.date),
            'time': _iso(self.time),
            'customer_name': self.customer_name,
            'currency': self.currency or 'AED',
            'exchange_rate': _num(self.exchange_rate, 1.0),
            'original_amount': _num(self.original_amount, _num(self.total_incl_vat)),
            'total_excl_vat': _num(self.total_excl_vat),
            'total_incl_vat': _num(self.total_incl_vat),
            'vat_rate': _num(self.vat_rate, 5.0),
            'vat_amount': _num(self.vat_amount),
            'vat_claimable': self.vat_claimable,
            'vat_issue': self.vat_issue,
            'payment_method': self.payment_method or 'Unknown',
            'refund_policy': self.refund_policy,
            'barcode': self.barcode,
            'category': self.category or 'Other',
            'notes': self.notes,
            'status': self.status or 'pending',
            'review_note': self.review_note,
            'reviewed_by': self.reviewer.name if self.reviewer else None,
            'reviewed_at': _iso(self.reviewed_at),
            'uploaded_by': self.uploader.name if self.uploader else None,
            'image_path': self.image_path,
            'raw_extraction': self.raw_extraction,
            'created_at': _iso(self.created_at),
            'updated_at': _iso(self.updated_at),
            'items': [item.to_dict() for item in self.items] if self.items else [],
        }


class ReceiptItem(db.Model):
    __tablename__ = 'receipt_items'

    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('receipts.id'), nullable=False)

    item_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    category = db.Column(db.String(50))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'receipt_id': self.receipt_id,
            'item_name': self.item_name,
            'quantity': int(self.quantity) if self.quantity is not None else 1,
            'price': _num(self.price),
            'category': self.category,
            'created_at': _iso(self.created_at),
        }


class User(db.Model):
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

    memberships = db.relationship('Membership', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'is_guest': self.is_guest,
            'preferred_currency': self.preferred_currency,
            'preferred_language': self.preferred_language,
            'created_at': _iso(self.created_at),
        }


class AuditLog(db.Model):
    """Immutable record of changes to receipts and company settings."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'))
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE, REVIEW
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.String(100))
    changes = db.Column(JSONB)
    ip_address = db.Column(db.String(45))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'changes': self.changes,
            'created_at': _iso(self.created_at),
        }
