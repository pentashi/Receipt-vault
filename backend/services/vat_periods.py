from datetime import date, timedelta
import calendar


def _add_months(year, month, delta):
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def period_for(day, start_month=1):
    """Return (start, end) of the VAT quarter containing `day`."""
    start_month = start_month if start_month in (1, 2, 3) else 1
    offset = (day.month - start_month) % 3
    year, month = _add_months(day.year, day.month, -offset)
    end_year, end_month = _add_months(year, month, 2)
    end = date(end_year, end_month, calendar.monthrange(end_year, end_month)[1])
    return date(year, month, 1), end


def parse_period(key, start_month=1):
    """`key` is the period's first month as YYYY-MM; defaults to the current quarter."""
    if key:
        try:
            year, month = (int(p) for p in key.split('-')[:2])
            return period_for(date(year, month, 1), start_month)
        except (ValueError, TypeError):
            pass
    return period_for(date.today(), start_month)


def return_due_date(period_end):
    """UAE VAT returns are due by the 28th day of the month after the period ends."""
    return period_end + timedelta(days=28)


def describe(start, end):
    return {
        'key': start.strftime('%Y-%m'),
        'start': start.isoformat(),
        'end': end.isoformat(),
        'label': f"{start.strftime('%b')} – {end.strftime('%b %Y')}",
        'due_date': return_due_date(end).isoformat(),
    }


def recent_periods(start_month=1, count=6):
    periods = []
    start, end = period_for(date.today(), start_month)
    for _ in range(count):
        periods.append(describe(start, end))
        start, end = period_for(start - timedelta(days=1), start_month)
    return periods
