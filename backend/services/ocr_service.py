import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import re
from datetime import datetime
import os

class OCRService:
    """Service for extracting text from receipt images using OCR"""
    
    def __init__(self, tesseract_path=None):
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    
    def _preprocess_image(self, image):
        """Preprocess image to improve OCR accuracy"""
        # Convert to grayscale
        image = image.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(1.5)

        # Resize image if too large (max width 1200px)
        max_width = 1200
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.ANTIALIAS)
        
        return image
    
    def extract_text(self, image_path):
        """Extract raw text from image using OCR"""
        try:
            image = Image.open(image_path)
            # Preprocess image for better OCR and resize
            image = self._preprocess_image(image)
            # Use only English for OCR to reduce memory
            text = pytesseract.image_to_string(image, lang='eng', config='--psm 6')
            return text
        except MemoryError:
            return "OCR failed: Out of memory. Try a smaller image."
        except Exception as e:
            return f"OCR extraction failed: {str(e)}"
    
    def parse_receipt(self, image_path):
        """Parse receipt image and extract structured data"""
        text = self.extract_text(image_path)
        
        # Detect receipt type first
        receipt_type = self._detect_receipt_type(text)
        
        receipt_data = {
            'receipt_type': receipt_type,
            'store_name': self._extract_store_name(text, receipt_type),
            'date': self._extract_date(text),
            'time': self._extract_time(text),
            'total_incl_vat': self._extract_total(text, receipt_type),
            'vat_amount': self._extract_vat(text),
            'items': self._extract_items(text, receipt_type),
            'payment_method': self._extract_payment_method(text),
            'transaction_trn': self._extract_trn(text),
            'raw_text': text
        }
        
        # Calculate VAT details
        if receipt_data['total_incl_vat'] and receipt_data['vat_amount']:
            receipt_data['total_excl_vat'] = receipt_data['total_incl_vat'] - receipt_data['vat_amount']
            if receipt_data['total_excl_vat'] > 0:
                receipt_data['vat_rate'] = (receipt_data['vat_amount'] / receipt_data['total_excl_vat']) * 100
        
        return receipt_data
    
    def _detect_receipt_type(self, text):
        """Detect the type of receipt based on keywords"""
        text_lower = text.lower()
        
        # Mobile/Telecom top-up
        if any(word in text_lower for word in ['mobile number', 'recharge', 'top-up', 'topup', 'prepaid', 'etisalat', 'du', 'upay']):
            return 'mobile_topup'
        
        # Transportation
        if any(word in text_lower for word in ['rta', 'metro', 'nol card', 'taxi', 'salik']):
            return 'transport'
        
        # Parking
        if any(word in text_lower for word in ['parking', 'park fee']):
            return 'parking'
        
        # Fuel/Petrol
        if any(word in text_lower for word in ['petrol', 'diesel', 'fuel', 'liters', 'litres', 'enoc', 'eppco', 'adnoc']):
            return 'fuel'
        
        # Supermarket (multiple items expected)
        if any(word in text_lower for word in ['supermarket', 'hypermarket', 'carrefour', 'lulu', 'vat rate']):
            return 'supermarket'
        
        # Restaurant/Cafe
        if any(word in text_lower for word in ['table', 'waiter', 'service charge', 'restaurant', 'cafe', 'coffee']):
            return 'restaurant'
        
        # Default
        return 'general'
    
    def _extract_store_name(self, text, receipt_type='general'):
        """Extract store name from receipt text"""
        lines = text.split('\n')
        
        # For mobile top-ups, look for specific provider names
        if receipt_type == 'mobile_topup':
            text_lower = text.lower()
            if 'upay' in text_lower:
                return 'UPay General Trading'
            if 'etisalat' in text_lower:
                return 'Etisalat'
            if 'du' in text_lower:
                return 'Du Telecom'
        
        # For transport, look for RTA/Metro
        if receipt_type == 'transport':
            text_lower = text.lower()
            if 'rta' in text_lower or 'metro' in text_lower:
                return 'RTA Metro'
            if 'taxi' in text_lower:
                return 'Dubai Taxi'
        # First, look for lines with business keywords
        business_keywords = ['llc', 'ltd', 'inc', 'corp', 'trading', 'general', 'store', 'market', 'shop', 'supermarket', 'pharmacy', 'restaurant', 'cafe']
        
        for line in lines[:15]:
            line_lower = line.lower().strip()
            
            # Check if line contains business keywords
            if any(keyword in line_lower for keyword in business_keywords):
                clean_line = line.strip()
                if len(clean_line) >= 4:
                    # Clean up common OCR errors
                    clean_line = clean_line.replace('  ', ' ')
                    return clean_line[:200]
        
        # Fallback: Look for any reasonable text line
        for line in lines[:10]:
            line = line.strip()
            
            # Skip empty lines
            if not line or len(line) < 4:
                continue
            
            # Skip lines with mostly special characters or numbers
            alpha_chars = sum(c.isalpha() for c in line)
            total_chars = len(line.replace(' ', ''))
            
            # Need at least 50% alphabetic characters
            if total_chars > 0 and (alpha_chars / total_chars) < 0.5:
                continue
            
            # Skip lines with excessive special characters
            special_chars = sum(c in '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~£€' for c in line)
            if special_chars > len(line) * 0.3:  # More than 30% special chars
                continue
            
            # This looks like a valid store name
            if len(line) >= 4:
                return line[:200]  # Limit length
        
        return 'Unknown Store'
    
    def _extract_date(self, text):
        """Extract date from receipt text"""
        # Common date formats: DD/MM/YY, DD-MM-YYYY, etc.
        date_patterns = [
            r'(\d{2}[/-]\d{2}[/-]\d{2,4})',
            r'(\d{4}[/-]\d{2}[/-]\d{2})'
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                date_str = match.group(1)
                try:
                    # Try different date formats
                    for fmt in ['%d/%m/%y', '%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d']:
                        try:
                            return datetime.strptime(date_str, fmt).date()
                        except ValueError:
                            continue
                except:
                    pass
        
        return datetime.now().date()
    
    def _extract_time(self, text):
        """Extract time from receipt text"""
        time_pattern = r'(\d{2}:\d{2}:\d{2})'
        match = re.search(time_pattern, text)
        if match:
            try:
                return datetime.strptime(match.group(1), '%H:%M:%S').time()
            except:
                pass
        return None
    
    def _extract_total(self, text, receipt_type='general'):
        """Extract total amount from receipt text"""
        text_lower = text.lower()
        
        # For mobile top-ups, prioritize "Accepted" and "Transacted"
        if receipt_type == 'mobile_topup':
            patterns = [
                r'accepted[:\s]+aed\.?\s+([0-9]+\.?[0-9]{0,2})',  # Highest priority
                r'transacted[:\s]+aed\.?\s+([0-9]+\.?[0-9]{0,2})',
                r'amount[:\s]+aed\.?\s+([0-9]+\.?[0-9]{0,2})',
            ]
        else:
            # General patterns
            patterns = [
                r'total\s+aed\.?\s+([0-9]+\.?[0-9]{0,2})',
                r'grand\s*total[:\s]+([0-9]+\.?[0-9]{0,2})',
                r'net\s*total[:\s]+([0-9]+\.?[0-9]{0,2})',
                r'total[:\s]+([0-9]+\.?[0-9]{0,2})',
                r'amount[:\s]+([0-9]+\.?[0-9]{0,2})',
            ]
        
        # Try patterns in order (first match wins)
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    amount = float(match.group(1))
                    # Validate amount is reasonable
                    if 0.10 <= amount <= 999999:
                        return amount
                except:
                    pass
        
        # Fallback: look for any amount with AED (but filter phone numbers)
        amounts = []
        aed_pattern = r'([0-9]+\.?[0-9]{0,2})\s*(?:aed|dhs)'
        matches = re.finditer(aed_pattern, text_lower)
        
        for match in matches:
            try:
                amount = float(match.group(1))
                # Filter out phone numbers (usually 10 digits) and unreasonable amounts
                amount_str = str(int(amount)) if amount.is_integer() else str(amount)
                if 0.10 <= amount <= 99999 and len(amount_str.replace('.', '')) < 7:
                    amounts.append(amount)
            except:
                pass
        
        return max(amounts) if amounts else 0.0
    
    def _extract_vat(self, text):
        """Extract VAT amount from receipt text"""
        patterns = [
            r'vat[:\s]+([0-9]+\.?[0-9]{0,2})',
            r'tax[:\s]+([0-9]+\.?[0-9]{0,2})',
            r'vat\s*amount[:\s]+([0-9]+\.?[0-9]{0,2})',
            r'tax\s*amount[:\s]+([0-9]+\.?[0-9]{0,2})',
        ]
        
        text_lower = text.lower()
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    vat = float(match.group(1))
                    if vat > 0:
                        return vat
                except:
                    pass
        return 0.0
    
    def _extract_items(self, text, receipt_type='general'):
        """Extract line items from receipt text"""
        items = []
        
        # Mobile top-ups and single-transaction receipts don't have items
        if receipt_type in ['mobile_topup', 'transport', 'parking']:
            return items
        
        lines = text.split('\n')
        
        for line in lines:
            # Look for lines with price patterns (more flexible)
            price_matches = re.findall(r'([0-9]+\.?[0-9]{0,2})\s*(?:aed|dhs)?', line.lower())
            
            if price_matches and len(line.strip()) > 5:
                # Check if line doesn't contain keywords we want to skip
                line_lower = line.lower()
                skip_keywords = [
                    'total', 'vat', 'tax', 'subtotal', 'change', 'cash', 'card', 'payment', 'balance',
                    'receipt', 'terminal', 'address', 'support', 'phone', 'mobile', 'number', 'tin',
                    'accepted', 'transacted', 'commission', 'date', 'time', 'trn', 'working', 'hours',
                    'dealer', 'service', 'customer', 'whatsapp', 'llc', 'ltd', 'trading', 'www'
                ]
                
                if not any(keyword in line_lower for keyword in skip_keywords):
                    # Get the last number as the price (usually at the end of line)
                    try:
                        price = float(price_matches[-1])
                        # Reasonable price range (0.10 to 9999.99)
                        if 0.10 <= price < 10000:
                            # Remove price from line to get item name
                            item_name = re.sub(r'[0-9]+\.?[0-9]{0,2}\s*(?:aed|dhs)?', '', line, flags=re.IGNORECASE).strip()
                            
                            # Item name should have some letters and not be too short
                            if len(item_name) > 3 and sum(c.isalpha() for c in item_name) >= 3:
                                items.append({
                                    'item_name': item_name[:200],
                                    'quantity': 1,
                                    'price': price
                                })
                    except:
                        pass
        
        return items[:50]  # Limit to 50 items
    
    def _extract_payment_method(self, text):
        """Extract payment method from receipt text"""
        text_lower = text.lower()
        if 'cash' in text_lower:
            return 'Cash'
        elif 'card' in text_lower or 'credit' in text_lower or 'debit' in text_lower:
            return 'Card'
        return 'Unknown'
    
    def _extract_trn(self, text):
        """Extract Tax Registration Number (TRN) from receipt text"""
        trn_pattern = r'trn[:\s]+([0-9]+)'
        match = re.search(trn_pattern, text.lower())
        if match:
            return match.group(1)
        return None
