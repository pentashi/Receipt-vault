from flask import Blueprint, request, jsonify, Response, g
from collections import defaultdict
from datetime import datetime
import csv
from io import StringIO

from models import Receipt
from services.tenancy import company_required, receipt_scope
from services.vat_periods import parse_period, describe, recent_periods

vat_bp = Blueprint('vat', __name__)

ISSUE_LABELS = {
    'missing_trn': 'Supplier TRN missing or invalid',
    'blocked_category': 'Category usually not recoverable',
    'no_vat': 'No VAT charged',
    'rejected': 'Rejected in review',
    'pending_review': 'Waiting for review',
}


def _period_receipts():
    start, end = parse_period(request.args.get('period'), g.company.vat_quarter_start_month)
    query = receipt_scope(Receipt.query, Receipt).filter(Receipt.date >= start, Receipt.date <= end)
    return start, end, query.order_by(Receipt.date.asc()).all()


@vat_bp.route('/periods', methods=['GET'])
@company_required()
def periods():
    return jsonify({'periods': recent_periods(g.company.vat_quarter_start_month)}), 200


@vat_bp.route('/summary', methods=['GET'])
@company_required()
def summary():
    start, end, receipts = _period_receipts()

    totals = {'count': 0, 'net': 0.0, 'vat': 0.0, 'gross': 0.0}
    claimable = {'count': 0, 'net': 0.0, 'vat': 0.0}
    issues = defaultdict(lambda: {'count': 0, 'vat': 0.0})
    by_category = defaultdict(lambda: {'net': 0.0, 'vat': 0.0, 'claimable_vat': 0.0})
    pending_review = 0

    for r in receipts:
        net, vat, gross = float(r.total_excl_vat or 0), float(r.vat_amount or 0), float(r.total_incl_vat or 0)
        if r.status != 'rejected':
            totals['count'] += 1
            totals['net'] += net
            totals['vat'] += vat
            totals['gross'] += gross
            by_category[r.category]['net'] += net
            by_category[r.category]['vat'] += vat
        if r.status == 'pending':
            pending_review += 1
        issue = r.vat_issue
        if issue is None:
            claimable['count'] += 1
            claimable['net'] += net
            claimable['vat'] += vat
            by_category[r.category]['claimable_vat'] += vat
        elif issue != 'no_vat':
            issues[issue]['count'] += 1
            issues[issue]['vat'] += vat

    def rounded(d):
        return {k: round(v, 2) if isinstance(v, float) else v for k, v in d.items()}

    return jsonify({
        'period': describe(start, end),
        'totals': rounded(totals),
        'claimable': rounded(claimable),
        'pending_review': pending_review,
        'issues': [{'type': k, 'label': ISSUE_LABELS[k], **rounded(v)} for k, v in issues.items()],
        'by_category': sorted(
            [{'category': k, **rounded(v)} for k, v in by_category.items()],
            key=lambda c: c['net'], reverse=True,
        ),
        # VAT201 box 9: standard rated expenses and the input VAT you can recover on them
        'vat201_box9': {'amount': round(claimable['net'], 2), 'recoverable_vat': round(claimable['vat'], 2)},
    }), 200


@vat_bp.route('/export', methods=['GET'])
@company_required(roles=('owner', 'accountant'))
def export():
    start, end, receipts = _period_receipts()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Date', 'Supplier', 'Supplier TRN', 'TRN valid', 'Category', 'Currency', 'Original amount',
        'Net (AED)', 'VAT (AED)', 'Gross (AED)', 'VAT claimable', 'Issue', 'Review status',
        'Uploaded by', 'Payment method', 'Receipt ID', 'Receipt image',
    ])
    for r in receipts:
        writer.writerow([
            r.date.isoformat() if r.date else '',
            r.store_name,
            r.transaction_trn or '',
            'Yes' if r.trn_valid else 'No',
            r.category,
            r.currency or 'AED',
            f"{float(r.original_amount or r.total_incl_vat or 0):.2f}",
            f"{float(r.total_excl_vat or 0):.2f}",
            f"{float(r.vat_amount or 0):.2f}",
            f"{float(r.total_incl_vat or 0):.2f}",
            'Yes' if r.vat_claimable else 'No',
            ISSUE_LABELS.get(r.vat_issue, ''),
            r.status or 'pending',
            r.uploader.name if r.uploader else '',
            r.payment_method or '',
            r.receipt_id,
            r.image_path or '',
        ])
    company_slug = ''.join(c if c.isalnum() else '-' for c in g.company.name).strip('-').lower()
    filename = f"{company_slug}_vat_{start.strftime('%Y-%m')}_to_{end.strftime('%Y-%m')}.csv"
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )
