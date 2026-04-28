import os
from google.cloud import documentai_v1 as documentai
from datetime import datetime, date
import re
import traceback

class OCRService:
    """Service for extracting text from receipt images using Google Cloud Document AI"""
    
    def __init__(self, processor_id=None):
        self.processor_id = processor_id or os.getenv(
            'DOCUMENT_AI_PROCESSOR_ID', 
            'projects/210041012141/locations/us/processors/b57c05dfadd5de1d'
        )
        print(f"OCRService initialized with processor: {self.processor_id}")
        
    def _get_document_ai_result(self, image_path):
        """Process image with Document AI Expense Processor"""
        try:
            client = documentai.DocumentProcessorServiceClient()
            
            with open(image_path, "rb") as image_file:
                image_content = image_file.read()
                
            ext = os.path.splitext(image_path)[1].lower()
            mime_type = "image/jpeg"
            if ext == '.pdf':
                mime_type = "application/pdf"
            elif ext == '.png':
                mime_type = "image/png"
                
            raw_document = documentai.RawDocument(
                content=image_content, mime_type=mime_type
            )
                
            request = documentai.ProcessRequest(
                name=self.processor_id, raw_document=raw_document
            )
            
            print(f"Sending request to Document AI for {image_path}...")
            result = client.process_document(request=request)
            return result

        except Exception as e:
            print(f"Error in _get_document_ai_result: {str(e)}")
            traceback.print_exc()
            raise e

    def _get_entity_value(self, entity):
        """Extract value from entity, preferring normalized value"""
        try:
            if entity.normalized_value:
                nv = entity.normalized_value
                if hasattr(nv, 'money_value') and nv.money_value:
                    # Handle case where units/nanos might be 0 but it's a valid amount
                    return float(nv.money_value.units) + (nv.money_value.nanos / 1e9)
                if hasattr(nv, 'date_value') and nv.date_value:
                    d = nv.date_value
                    if d.year > 1900: # Ensure it's a realistic year
                        return date(d.year, d.month, d.day)
                if hasattr(nv, 'text') and nv.text:
                    if nv.text.strip() and nv.text.strip() != "0.0":
                        return nv.text
            
            # Fallback to mention text if normalized is invalid or "0.0"
            mention = entity.mention_text
            if mention == "0.0" or not mention:
                return None
            return mention
        except Exception as e:
            print(f"Error extracting entity value: {str(e)}")
            return entity.mention_text if entity.mention_text != "0.0" else None

    def parse_receipt(self, image_path):
        """Parse receipt image and extract structured data using Document AI"""
        try:
            result = self._get_document_ai_result(image_path)
            document = result.document
            
            receipt_data = {
                'store_name': 'Unknown Store',
                'date': date.today(),
                'time': None,
                'total_incl_vat': 0.0,
                'vat_amount': 0.0,
                'items': [],
                'payment_method': 'Unknown',
                'transaction_trn': None,
                'address': None,
                'phone_number': None,
                'currency': 'AED',
                'raw_text': getattr(document, 'text', ''),
                'raw_extraction': {} # Will hold simplified JSON of entities
            }
            
            # Helper for raw extraction storage
            entities_json = {}

            if hasattr(document, 'entities'):
                for entity in document.entities:
                    etype = entity.type_
                    val = self._get_entity_value(entity)
                    
                    if val is None:
                        continue

                    # Store in raw extraction (handle multiple entities of same type)
                    if etype in entities_json:
                        if not isinstance(entities_json[etype], list):
                            entities_json[etype] = [entities_json[etype]]
                        entities_json[etype].append(str(val))
                    else:
                        entities_json[etype] = str(val)

                    if etype == 'supplier_name':
                        receipt_data['store_name'] = str(val)
                    elif etype == 'supplier_address':
                        receipt_data['address'] = str(val)
                    elif etype == 'supplier_phone_number':
                        receipt_data['phone_number'] = str(val)
                    elif etype == 'currency':
                        curr = str(val).upper()
                        if len(curr) <= 3 and curr.isalpha():
                            receipt_data['currency'] = curr
                    elif etype == 'receipt_date':
                        if isinstance(val, date):
                            receipt_data['date'] = val
                        elif isinstance(val, datetime):
                            receipt_data['date'] = val.date()
                        else:
                            try:
                                # Try multiple regex patterns to extract date
                                clean_date = re.sub(r'[^\d/.-]', '', str(val))
                                if len(clean_date) >= 6:
                                    for fmt in ('%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y', '%Y.%m.%d'):
                                        try:
                                            receipt_data['date'] = datetime.strptime(clean_date, fmt).date()
                                            break
                                        except:
                                            continue
                            except:
                                pass
                    elif etype == 'total_amount':
                        try:
                            if isinstance(val, (int, float)):
                                receipt_data['total_incl_vat'] = float(val)
                            else:
                                clean_val = re.sub(r'[^\d.]', '', str(val))
                                if clean_val:
                                    receipt_data['total_incl_vat'] = float(clean_val)
                        except:
                            pass
                    elif etype == 'total_tax_amount':
                        try:
                            if isinstance(val, (int, float)):
                                receipt_data['vat_amount'] = float(val)
                            else:
                                clean_val = re.sub(r'[^\d.]', '', str(val))
                                if clean_val:
                                    receipt_data['vat_amount'] = float(clean_val)
                        except:
                            pass
                    elif etype == 'line_item':
                        item = {'item_name': 'Unknown Item', 'quantity': 1, 'price': 0.0}
                        for prop in entity.properties:
                            sub_etype = prop.type_
                            sub_val = self._get_entity_value(prop)
                            
                            if sub_val is None: continue

                            if sub_etype == 'line_item/description':
                                item['item_name'] = str(sub_val)
                            elif sub_etype == 'line_item/amount':
                                try:
                                    if isinstance(sub_val, (int, float)):
                                        item['price'] = float(sub_val)
                                    else:
                                        item['price'] = float(re.sub(r'[^\d.]', '', str(sub_val)))
                                except:
                                    pass
                            elif sub_etype == 'line_item/quantity':
                                try:
                                    item['quantity'] = int(float(str(sub_val)))
                                except:
                                    pass
                        receipt_data['items'].append(item)
                    elif etype == 'payment_type':
                        receipt_data['payment_method'] = str(val).title()
                    elif etype == 'supplier_tax_id':
                        receipt_data['transaction_trn'] = str(val)

            receipt_data['raw_extraction'] = entities_json

            # UAE-specific logic: Calculate implied VAT if not explicitly found
            total = receipt_data['total_incl_vat']
            vat = receipt_data['vat_amount']
            
            if total > 0 and vat == 0:
                # Most UAE receipts have 5% VAT included.
                # Implied VAT = Total - (Total / 1.05)
                receipt_data['vat_amount'] = round(total - (total / 1.05), 2)
                receipt_data['vat_rate'] = 5.0
                print(f"Calculated implied UAE VAT: {receipt_data['vat_amount']}")
            
            receipt_data['total_excl_vat'] = round(total - receipt_data['vat_amount'], 2)
            
            if receipt_data['total_excl_vat'] > 0 and receipt_data['vat_amount'] > 0:
                receipt_data['vat_rate'] = round((receipt_data['vat_amount'] / receipt_data['total_excl_vat']) * 100, 1)
            else:
                receipt_data['vat_rate'] = 5.0

            return receipt_data

        except Exception as e:
            print(f"parse_receipt failed: {str(e)}")
            traceback.print_exc()
            return {
                'store_name': f'Error: {str(e)[:30]}',
                'date': date.today(),
                'total_incl_vat': 0.0,
                'items': [],
                'raw_text': f"Error: {str(e)}",
                'raw_extraction': {}
            }
