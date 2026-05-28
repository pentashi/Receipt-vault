
# ReceiptVault

Enterprise-Ready Receipt Scanning and Smart Expense Tracking for Dubai & UAE Businesses

ReceiptVault is a full-stack, scalable, and secure expense management platform designed for UAE enterprises and residents. It supports compliance with UAE VAT, privacy, and data security standards, and is ready for production deployment in Dubai organizations.

## Features

### Core Features
- 📷 **Receipt Scanning**: Upload and scan receipts using Google Cloud Document AI Expense Processor
- 💰 **Expense Tracking**: Automatically extract store name, date, items, prices, and VAT
- 📊 **Dashboard Analytics**: Visualize spending patterns with charts and graphs
- 🏷️ **Categorization**: Organize expenses by category (Groceries, Dining, Transport, etc.)
- 💳 **VAT Tracking**: Track UAE VAT (5%) on all purchases
- 📈 **Budget Management**: Set monthly budgets by category with alerts
- 🔍 **Search & Filter**: Find receipts by store, date, category
- 📱 **Responsive Design**: Works on desktop and mobile devices

### UAE & Dubai-Specific Features
- AED currency support
- 5% VAT calculations (UAE FTA-compliant)
- Bilingual support ready (English/Arabic, RTL UI)
- Receipt format optimized for UAE/Dubai stores
- Ready for integration with UAE e-invoicing and government APIs (roadmap)

## Tech Stack

### Backend
- **Python 3.10+**
- **Flask** - Web framework
- **Flask-SQLAlchemy** - ORM for database
- **Google Cloud Document AI** - Enterprise receipt intelligence and field extraction
- **Google Cloud Storage (GCS)** - Secure receipt file storage
- **PostgreSQL/SQLite** - Database (PostgreSQL recommended for enterprise)
- **Flask-CORS** - Cross-origin support
- **Gunicorn**/**uWSGI** - Production WSGI server
### Security & Compliance
- Data encrypted at rest and in transit (when deployed with HTTPS)
- Ready for SSO, audit logs, and role-based access (roadmap)
- GDPR & UAE data privacy best practices
- Audit trail and logging (roadmap)
### Deployment & Scalability
- Dockerfile and docker-compose for containerized deployment (recommended for enterprise)
- Cloud-ready: Deployable on GCP (preferred), Azure, AWS, or on-premises
- Horizontal scaling with PostgreSQL and stateless backend

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Recharts** - Data visualization
- **Axios** - API calls
- **Lucide React** - Icons
- RTL and Arabic support (ready)

## Project Structure

```
receiptvault/
├── backend/
│   ├── app.py              # Flask application entry point
│   ├── config.py           # Configuration settings
│   ├── models.py           # Database models
│   ├── requirements.txt    # Python dependencies
│   ├── routes/
│   │   ├── receipts.py     # Receipt upload and management
│   │   ├── expenses.py     # Expense analytics
│   │   └── budgets.py      # Budget management
│   └── services/
│       └── ocr_service.py  # OCR text extraction
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ReceiptUpload.tsx
│   │   │   ├── ReceiptList.tsx
│   │   │   └── BudgetManager.tsx
│   │   ├── services/
│   │   │   └── api.ts      # API client
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- Google Cloud project with Document AI enabled
- Google Cloud Storage bucket
- Service account with access to Document AI and GCS

### Configuring Google Cloud Document AI & GCS

1. Create or select a GCP project.
2. Enable **Document AI API** and **Cloud Storage API**.
3. Create a Document AI Expense processor and copy its processor resource path:
   `projects/<project-id>/locations/<location>/processors/<processor-id>`
4. Create a GCS bucket for receipt image storage.
5. Create a service account with required roles (Document AI + Storage object access).
6. Export Google credentials before running the backend:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
   ```


### Backend Setup (Enterprise/Production)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment variables:**
   ```bash
   copy .env.example .env
   ```
   Edit `.env` and update:
   - `SECRET_KEY` - Change to a secure random key
   - `DOCUMENT_AI_PROCESSOR_ID` - Document AI processor resource name
   - `GCS_BUCKET_NAME` - Bucket name used for receipt image uploads
   - `DATABASE_URL` - SQLite (default) or PostgreSQL connection string

6. **Run the backend (Development):**
   ```bash
   python app.py
   ```
   Backend will run on `http://localhost:5000`

7. **Run the backend (Production/Enterprise):**
   ```bash
   gunicorn -w 4 app:app
   # or use docker-compose up
   ```


### Frontend Setup (Enterprise/Production)

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   copy .env.example .env
   ```
   The default API URL is `http://localhost:5000/api/v1`

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

5. **Build for production:**
   ```bash
   npm run build
   # Serve with nginx, Vercel, or any static host
   ```

## Usage

### 1. Upload Receipt
- Click "Upload Receipt" tab
- Select or drag-and-drop a receipt image (PNG, JPG, JPEG, or PDF)
- Click "Upload & Scan Receipt"
- The app will automatically extract structured information using Document AI

### 2. View Receipts
- Click "My Receipts" to see all uploaded receipts
- Filter by store name, category, or date range
- Click the eye icon to view receipt details
- Delete receipts using the trash icon

### 3. Dashboard
- View spending summary for the current month
- See category breakdown in pie chart
- Analyze spending trends over 6 months
- Track total VAT paid

### 4. Budget Management
- Click "Budgets" tab
- Set monthly limits for each expense category
- Configure alert thresholds (e.g., 80%)
- Monitor budget usage with progress bars
- Receive alerts when approaching or exceeding limits

## API Endpoints

### Receipts
- `POST /api/v1/receipts/upload` - Upload and scan receipt
- `GET /api/v1/receipts/` - Get all receipts (with filters)
- `GET /api/v1/receipts/<receipt_id>` - Get specific receipt
- `PUT /api/v1/receipts/<receipt_id>` - Update receipt
- `DELETE /api/v1/receipts/<receipt_id>` - Delete receipt

### Expenses
- `GET /api/v1/expenses/summary` - Get expense summary
- `GET /api/v1/expenses/trends` - Get spending trends
- `GET /api/v1/expenses/top-stores` - Get top stores by spending
- `GET /api/v1/expenses/categories` - Get available categories
- `GET /api/v1/expenses/export` - Export expenses as CSV

### Budgets
- `GET /api/v1/budgets/` - Get budgets for month
- `POST /api/v1/budgets/` - Create budget
- `PUT /api/v1/budgets/<budget_id>` - Update budget
- `DELETE /api/v1/budgets/<budget_id>` - Delete budget
- `GET /api/v1/budgets/alerts` - Get budget alerts

## Database Schema

### Receipts Table
- Store information (name, address, phone, TRN)
- Transaction details (date, time, payment method)
- Financial data (total, VAT, category)
- Image path

### Receipt Items Table
- Item name, quantity, price
- Links to parent receipt

### Budgets Table
- Category, monthly limit
- Month and year
- Alert threshold

### Users Table (Future)
- Email, name, password
- Preferences (currency, language)

## Development

### Running Tests
```bash
# Backend tests (if available)
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

### Building for Production

**Backend:**
```bash
pip install gunicorn
gunicorn -w 4 app:app
```

**Frontend:**
```bash
npm run build
```

## Troubleshooting

### OCR Not Working
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON
- Verify `DOCUMENT_AI_PROCESSOR_ID` and `GCS_BUCKET_NAME` values in `.env`
- Confirm Document AI and Cloud Storage APIs are enabled in your GCP project

### Database Errors
- Check `DATABASE_URL` in `.env`
- Ensure database file has write permissions
- Delete `cemac.db` and restart to reset database

### Port Already in Use
- Backend: Change port in `app.py`: `app.run(port=5001)`
- Frontend: Change port in `vite.config.ts`

## Future Enterprise Enhancements

- 🔐 User authentication, SSO, and multi-user support
- 🛡️ Role-based access control and audit logs
- 📧 Email/SMS notifications for budget alerts
- 📱 Mobile app (React Native)
- 🤖 AI-powered auto-categorization
- 🌍 Multi-currency support
- ☁️ Cloud storage integration
- 📊 Advanced analytics and insights
- 💾 Automatic backup/restore
- 🧾 PDF receipt generation
- 📈 Monthly expense reports
- 🏢 Integration with UAE e-invoicing/government APIs

## OCR Evolution (Architecture Note)

ReceiptVault initially started with a local **Python + pytesseract** OCR path during early prototyping.  
The current enterprise architecture is now standardized on **Google Cloud Document AI** for extraction quality and **Google Cloud Storage** for scalable receipt storage, providing a production-ready GCP-aligned pipeline.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please create an issue on GitHub or contact the development team.

---

**Made with ❤️ for Dubai & UAE enterprises** 🇦🇪
