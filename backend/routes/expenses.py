from flask import Blueprint, request, jsonify, Response
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from collections import defaultdict
import csv
from io import StringIO

from models import db, Receipt, ReceiptItem
from config import Config

expenses_bp = Blueprint('expenses', __name__)


@expenses_bp.route('/summary', methods=['GET'])
def get_expense_summary():
    """Get expense summary for a period"""
    try:
        # Query parameters
        period = request.args.get('period', 'month')  # month, year, week
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month', datetime.now().month, type=int)
        
        query = Receipt.query
        
        if period == 'month':
            query = query.filter(
                extract('year', Receipt.date) == year,
                extract('month', Receipt.date) == month
            )
        elif period == 'year':
            query = query.filter(extract('year', Receipt.date) == year)
        elif period == 'week':
            # Last 7 days
            start_date = datetime.now().date() - timedelta(days=7)
            query = query.filter(Receipt.date >= start_date)
        
        receipts = query.all()
        
        # Calculate totals
        total_spent = sum(float(r.total_incl_vat) for r in receipts)
        total_vat = sum(float(r.vat_amount) if r.vat_amount else 0 for r in receipts)
        
        # Group by category
        category_totals = defaultdict(float)
        for receipt in receipts:
            category_totals[receipt.category] += float(receipt.total_incl_vat)
        
        # Group by payment method
        payment_method_totals = defaultdict(float)
        for receipt in receipts:
            method = receipt.payment_method or 'Unknown'
            payment_method_totals[method] += float(receipt.total_incl_vat)
        
        return jsonify({
            'period': period,
            'year': year,
            'month': month if period == 'month' else None,
            'total_spent': total_spent,
            'total_vat': total_vat,
            'receipt_count': len(receipts),
            'category_breakdown': dict(category_totals),
            'payment_method_breakdown': dict(payment_method_totals),
            'average_per_receipt': total_spent / len(receipts) if receipts else 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/trends', methods=['GET'])
def get_expense_trends():
    """Get expense trends over time"""
    try:
        months = request.args.get('months', 6, type=int)  # Last N months
        
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=months * 30)
        
        receipts = Receipt.query.filter(
            Receipt.date >= start_date,
            Receipt.date <= end_date
        ).all()
        
        # Group by month
        monthly_data = defaultdict(lambda: {'total': 0, 'count': 0})
        
        for receipt in receipts:
            month_key = receipt.date.strftime('%Y-%m')
            monthly_data[month_key]['total'] += float(receipt.total_incl_vat)
            monthly_data[month_key]['count'] += 1
        
        # Convert to list and sort
        trends = [
            {
                'month': month,
                'total_spent': data['total'],
                'receipt_count': data['count'],
                'average': data['total'] / data['count'] if data['count'] > 0 else 0
            }
            for month, data in sorted(monthly_data.items())
        ]
        
        return jsonify({
            'months': months,
            'trends': trends
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get list of expense categories"""
    try:
        return jsonify({
            'categories': Config.EXPENSE_CATEGORIES
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/top-stores', methods=['GET'])
def get_top_stores():
    """Get top stores by spending"""
    try:
        limit = request.args.get('limit', 10, type=int)
        
        # Query to group by store and sum totals
        results = db.session.query(
            Receipt.store_name,
            func.count(Receipt.id).label('visit_count'),
            func.sum(Receipt.total_incl_vat).label('total_spent')
        ).group_by(Receipt.store_name)\
         .order_by(func.sum(Receipt.total_incl_vat).desc())\
         .limit(limit)\
         .all()
        
        top_stores = [
            {
                'store_name': row.store_name,
                'visit_count': row.visit_count,
                'total_spent': float(row.total_spent) if row.total_spent else 0
            }
            for row in results
        ]
        
        return jsonify({
            'top_stores': top_stores
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/export', methods=['GET'])
def export_expenses():
    """Export expenses as CSV file"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        format_type = request.args.get('format', 'csv')  # csv or json
        
        query = Receipt.query
        
        if start_date:
            query = query.filter(Receipt.date >= datetime.fromisoformat(start_date).date())
        
        if end_date:
            query = query.filter(Receipt.date <= datetime.fromisoformat(end_date).date())
        
        receipts = query.order_by(Receipt.date.desc()).all()
        
        if format_type == 'csv':
            # Generate CSV file
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Date', 'Store', 'Category', 'Total (Incl VAT)', 'VAT Amount', 'Total (Excl VAT)', 'Payment Method', 'Items Count', 'TRN'])
            
            # Write data
            for receipt in receipts:
                writer.writerow([
                    receipt.date.strftime('%Y-%m-%d') if receipt.date else '',
                    receipt.store_name,
                    receipt.category,
                    f"{receipt.total_incl_vat:.2f}" if receipt.total_incl_vat else '0.00',
                    f"{receipt.vat_amount:.2f}" if receipt.vat_amount else '0.00',
                    f"{receipt.total_excl_vat:.2f}" if receipt.total_excl_vat else '0.00',
                    receipt.payment_method or 'Unknown',
                    len(receipt.items) if receipt.items else 0,
                    receipt.transaction_trn or ''
                ])
            
            # Create response
            output.seek(0)
            filename = f"receiptvault_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename={filename}'}
            )
        else:
            # Return JSON format (original behavior)
            csv_data = []
            headers = ['Date', 'Store', 'Category', 'Total (AED)', 'VAT (AED)', 'Payment Method']
            csv_data.append(headers)
            
            for receipt in receipts:
                row = [
                    receipt.date.isoformat() if receipt.date else '',
                    receipt.store_name,
                    receipt.category,
                    str(receipt.total_incl_vat) if receipt.total_incl_vat else '0',
                    str(receipt.vat_amount) if receipt.vat_amount else '0',
                    receipt.payment_method or ''
                ]
                csv_data.append(row)
            
            return jsonify({
                'csv_data': csv_data,
                'record_count': len(receipts)
            }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
