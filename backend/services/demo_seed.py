import random
import uuid
from datetime import date, timedelta

from models import db, Company, Membership, Receipt, ReceiptItem
from services.vat_periods import period_for

# (supplier, category, gross AED range, has TRN, payment)
DEMO_SUPPLIERS = [
    ('ENOC Al Quoz', 'Fuel & Vehicle', (180, 320), True, 'Card'),
    ('ADNOC Distribution', 'Fuel & Vehicle', (150, 280), True, 'Card'),
    ('Dubai Electricity & Water Authority', 'Utilities (DEWA/SEWA)', (900, 1800), True, 'Bank Transfer'),
    ('du Business', 'Telecom & Internet', (450, 650), True, 'Card'),
    ('Etisalat by e&', 'Telecom & Internet', (299, 499), True, 'Card'),
    ('Aramex Business Bay', 'Logistics & Courier', (60, 240), True, 'Card'),
    ('Sharaf DG Business', 'IT, Software & Equipment', (1200, 5400), True, 'Card'),
    ('Office Supplies Trading LLC', 'Office & Supplies', (90, 640), True, 'Cash'),
    ('Careem Business', 'Transport & Travel', (35, 120), True, 'Card'),
    ('Salt Bae Downtown', 'Meals & Entertainment', (350, 1400), True, 'Card'),
    ('Al Mallah Cafeteria', 'Meals & Entertainment', (25, 70), False, 'Cash'),
    ('Dubai Taxi', 'Transport & Travel', (30, 95), False, 'Cash'),
    ('Rapid Print Services', 'Marketing & Advertising', (250, 1800), False, 'Cash'),
    ('Emirates Facility Management', 'Maintenance & Repairs', (400, 2200), True, 'Bank Transfer'),
]


def _fake_trn(seed):
    rnd = random.Random(seed)
    return '100' + ''.join(str(rnd.randint(0, 9)) for _ in range(12))


def seed_demo_company(user):
    company = Company(name='Al Noor Trading LLC', trn=_fake_trn('al-noor'), emirate='Dubai',
                      vat_quarter_start_month=1, is_demo=True)
    db.session.add(company)
    db.session.flush()
    db.session.add(Membership(user_id=user.id, company_id=company.id, role='owner'))

    rnd = random.Random(user.id)
    today = date.today()
    start, _ = period_for(today, 1)
    previous_start, _ = period_for(start - timedelta(days=1), 1)
    span_days = max((today - previous_start).days, 1)

    for i in range(26):
        supplier, category, (low, high), has_trn, payment = DEMO_SUPPLIERS[i % len(DEMO_SUPPLIERS)]
        receipt_date = previous_start + timedelta(days=rnd.randint(0, span_days))
        gross = round(rnd.uniform(low, high), 2)
        vat = round(gross - gross / 1.05, 2)
        in_current = receipt_date >= start
        status = rnd.choice(['pending', 'pending', 'approved']) if in_current else 'approved'
        receipt = Receipt(
            user_id=user.id,
            company_id=company.id,
            receipt_id=str(uuid.uuid4()),
            store_name=supplier,
            transaction_trn=_fake_trn(supplier) if has_trn else None,
            date=receipt_date,
            currency='AED',
            exchange_rate=1.0,
            original_amount=gross,
            total_incl_vat=gross,
            vat_amount=vat,
            total_excl_vat=round(gross - vat, 2),
            vat_rate=5.0,
            category=category,
            payment_method=payment,
            status=status,
            notes='Sample receipt',
        )
        db.session.add(receipt)
        db.session.flush()
        db.session.add(ReceiptItem(receipt_id=receipt.id, item_name=category, quantity=1, price=round(gross - vat, 2)))
    return company
