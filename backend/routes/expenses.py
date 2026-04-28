from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from collections import defaultdict
import csv
from io import StringIO

from models import db, Receipt, ReceiptItem
from config import Config

expenses_bp = Blueprint('expenses', __name__)


@expenses_bp.route('/subscriptions', methods=['GET'])
@jwt_required()
def get_subscriptions():
    """Analyze transaction patterns to identify recurring bills/subscriptions"""
    user_id = get_jwt_identity()
    try:
        # Get all receipts for the last 6 months to detect patterns
        start_date = datetime.now().date() - timedelta(days=180)
        receipts = Receipt.query.filter(
            Receipt.user_id == user_id,
            Receipt.date >= start_date
        ).all()
        
        # Group by store name to find recurring payments
        merchant_counts = defaultdict(list)
        for r in receipts:
            merchant_counts[r.store_name].append(r)
            
        subscriptions = []
        for merchant, transactions in merchant_counts.items():
            if len(transactions) >= 3:
                # Basic recurring check: if merchant occurs monthly
                # Sort by date
                sorted_tx = sorted(transactions, key=lambda x: x.date)
                
                # Calculate intervals
                intervals = []
                for i in range(1, len(sorted_tx)):
                    intervals.append((sorted_tx[i].date - sorted_tx[i-1].date).days)
                
                # If average interval is around 30 days (25-35 range)
                avg_interval = sum(intervals) / len(intervals)
                if 25 <= avg_interval <= 35:
                    latest = sorted_tx[-1]
                    subscriptions.append({
                        'merchant': merchant,
                        'category': latest.category,
                        'avg_amount': sum(float(tx.total_incl_vat) for tx in transactions) / len(transactions),
                        'frequency': 'Monthly',
                        'last_payment': latest.date.isoformat(),
                        'next_predicted': (latest.date + timedelta(days=30)).isoformat(),
                        'confidence': 'High'
                    })
        
        return jsonify({'subscriptions': subscriptions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/forecast', methods=['GET'])
@jwt_required()
def get_spending_forecast():
    """Predict end-of-month spending based on current pace"""
    user_id = get_jwt_identity()
    try:
        now = datetime.now()
        month = now.month
        year = now.year
        day = now.day
        import calendar
        _, days_in_month = calendar.monthrange(year, month)
        
        # Get current month total
        current_spent = db.session.query(func.sum(Receipt.total_incl_vat)).filter(
            Receipt.user_id == user_id,
            extract('month', Receipt.date) == month,
            extract('year', Receipt.date) == year
        ).scalar() or 0
        
        daily_avg = float(current_spent) / day
        projected = daily_avg * days_in_month
        
        return jsonify({
            'current_spent': float(current_spent),
            'daily_average': round(daily_avg, 2),
            'projected_total': round(projected, 2),
            'days_remaining': days_in_month - day,
            'confidence': 'Medium' if day > 10 else 'Low'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_expense_summary():
    """Get expense summary for a period"""
    user_id = get_jwt_identity()
    try:
        # Query parameters
        period = request.args.get('period', 'month')  # month, year, week
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month', datetime.now().month, type=int)
        
        query = Receipt.query.filter_by(user_id=user_id)
        
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


@expenses_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get all allowed expense categories"""
    return jsonify({'categories': Config.EXPENSE_CATEGORIES}), 200


@expenses_bp.route('/daily-trends', methods=['GET'])
@jwt_required()
def get_daily_trends():
    """Get daily expense trends for the current month or specified period"""
    user_id = get_jwt_identity()
    try:
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        # Determine number of days in the month
        import calendar
        _, num_days = calendar.monthrange(year, month)
        
        start_date = datetime(year, month, 1).date()
        end_date = datetime(year, month, num_days).date()
        
        receipts = Receipt.query.filter(
            Receipt.user_id == user_id,
            Receipt.date >= start_date,
            Receipt.date <= end_date
        ).all()
        
        # Initialize dictionary with all days of the month
        daily_data = {i: 0.0 for i in range(1, num_days + 1)}
        
        for receipt in receipts:
            day = receipt.date.day
            daily_data[day] += float(receipt.total_incl_vat)
            
        # Convert to sorted list of dicts
        trends = [
            {'day': day, 'total_spent': amount}
            for day, amount in sorted(daily_data.items())
        ]
        
        return jsonify({
            'month': month,
            'year': year,
            'trends': trends
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expenses_bp.route('/trends', methods=['GET'])
@jwt_required()
def get_expense_trends():
    """Get expense trends over time"""
    user_id = get_jwt_identity()
    try:
        months = request.args.get('months', 6, type=int)  # Last N months
        
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=months * 30)
        
        receipts = Receipt.query.filter(
            Receipt.user_id == user_id,
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


@expenses_bp.route('/top-stores', methods=['GET'])
@jwt_required()
def get_top_stores():
    """Get top stores by spending"""
    user_id = get_jwt_identity()
    try:
        limit = request.args.get('limit', 10, type=int)
        
        # Query to group by store and sum totals
        results = db.session.query(
            Receipt.store_name,
            func.count(Receipt.id).label('visit_count'),
            func.sum(Receipt.total_incl_vat).label('total_spent')
        ).filter(Receipt.user_id == user_id)\
         .group_by(Receipt.store_name)\
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
@jwt_required()
def export_expenses():
    """Export expenses as CSV file"""
    user_id = get_jwt_identity()
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        format_type = request.args.get('format', 'csv')  # csv or json
        
        query = Receipt.query.filter_by(user_id=user_id)
        
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
