from flask import Blueprint, request, jsonify, g
from sqlalchemy import func, extract
from datetime import datetime, date
from collections import defaultdict

from models import db, Receipt
from config import Config
from services.tenancy import company_required, receipt_scope
from services.vat_periods import period_for, describe

expenses_bp = Blueprint('expenses', __name__)


@expenses_bp.route('/summary', methods=['GET'])
@company_required()
def get_expense_summary():
    """Spend overview for the current VAT quarter (or a month/year)."""
    try:
        period = request.args.get('period', 'quarter')
        query = receipt_scope(Receipt.query, Receipt).filter(Receipt.status != 'rejected')
        info = None
        if period == 'quarter':
            start, end = period_for(date.today(), g.company.vat_quarter_start_month)
            query = query.filter(Receipt.date >= start, Receipt.date <= end)
            info = describe(start, end)
        elif period == 'month':
            year = request.args.get('year', datetime.now().year, type=int)
            month = request.args.get('month', datetime.now().month, type=int)
            query = query.filter(extract('year', Receipt.date) == year, extract('month', Receipt.date) == month)
        elif period == 'year':
            year = request.args.get('year', datetime.now().year, type=int)
            query = query.filter(extract('year', Receipt.date) == year)
        receipts = query.all()

        category_totals = defaultdict(float)
        for r in receipts:
            category_totals[r.category] += float(r.total_incl_vat)

        total_spent = sum(float(r.total_incl_vat) for r in receipts)
        pending_q = receipt_scope(Receipt.query, Receipt).filter(Receipt.status == 'pending')
        return jsonify({
            'period': period,
            'period_info': info,
            'total_spent': round(total_spent, 2),
            'total_vat': round(sum(float(r.vat_amount or 0) for r in receipts), 2),
            'claimable_vat': round(sum(float(r.vat_amount or 0) for r in receipts if r.vat_claimable), 2),
            'missing_trn_count': sum(1 for r in receipts if r.vat_issue == 'missing_trn'),
            'receipt_count': len(receipts),
            'pending_review_count': pending_q.count(),
            'category_breakdown': {k: round(v, 2) for k, v in category_totals.items()},
            'average_per_receipt': round(total_spent / len(receipts), 2) if receipts else 0,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/categories', methods=['GET'])
@company_required()
def get_categories():
    return jsonify({'categories': Config.EXPENSE_CATEGORIES}), 200


@expenses_bp.route('/trends', methods=['GET'])
@company_required()
def get_expense_trends():
    """Monthly spend and VAT for the last N months."""
    try:
        months = request.args.get('months', 6, type=int)
        today = date.today()
        index = today.year * 12 + today.month - 1 - (months - 1)
        start = date(index // 12, index % 12 + 1, 1)

        receipts = receipt_scope(Receipt.query, Receipt).filter(
            Receipt.date >= start, Receipt.date <= today, Receipt.status != 'rejected'
        ).all()

        monthly = {}
        for i in range(months):
            idx = index + i
            key = f"{idx // 12}-{idx % 12 + 1:02d}"
            monthly[key] = {'month': key, 'total_spent': 0.0, 'vat': 0.0, 'claimable_vat': 0.0, 'receipt_count': 0}
        for r in receipts:
            row = monthly.get(r.date.strftime('%Y-%m'))
            if not row:
                continue
            row['total_spent'] += float(r.total_incl_vat)
            row['vat'] += float(r.vat_amount or 0)
            if r.vat_claimable:
                row['claimable_vat'] += float(r.vat_amount or 0)
            row['receipt_count'] += 1
        trends = [{k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()} for row in monthly.values()]
        return jsonify({'months': months, 'trends': trends}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/top-stores', methods=['GET'])
@company_required()
def get_top_stores():
    """Top suppliers by spend."""
    try:
        limit = request.args.get('limit', 5, type=int)
        query = receipt_scope(db.session.query(
            Receipt.store_name,
            func.count(Receipt.id).label('visit_count'),
            func.sum(Receipt.total_incl_vat).label('total_spent'),
        ), Receipt).filter(Receipt.status != 'rejected')
        results = query.group_by(Receipt.store_name).order_by(func.sum(Receipt.total_incl_vat).desc()).limit(limit).all()
        return jsonify({'top_stores': [
            {'store_name': row.store_name, 'visit_count': row.visit_count, 'total_spent': float(row.total_spent or 0)}
            for row in results
        ]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
