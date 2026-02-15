import os
import uuid
from models import db, Receipt
from app import app

# This script will assign a new UUID to any receipt missing a receipt_id

def fix_receipt_ids():
    with app.app_context():
        receipts = Receipt.query.filter((Receipt.receipt_id == None) | (Receipt.receipt_id == '')).all()
        print(f"Found {len(receipts)} receipts missing receipt_id.")
        for receipt in receipts:
            new_id = str(uuid.uuid4())
            print(f"Assigning receipt_id {new_id} to receipt DB id {receipt.id}")
            receipt.receipt_id = new_id
        db.session.commit()
        print("All missing receipt_id values have been fixed.")

if __name__ == "__main__":
    fix_receipt_ids()
