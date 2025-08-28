# 🏦 Multi-Bank Loan Recovery & Agent Management System

A comprehensive full-stack web application for managing loan recovery operations across multiple banks with dedicated agent interfaces, real-time reconciliation, and automated reporting.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup
```bash
git clone <repository-url>
cd bank-loan-recovery-system

# Copy environment file and configure
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Development Environment
```bash
# Start all services with Docker Compose
npm run docker:dev

# Or start services individually
npm install
npm run dev
```

### 3. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/docs
- **Database Admin**: http://localhost:8080 (Adminer)
- **Redis Admin**: http://localhost:8081 (Redis Commander)

### 4. Demo Login
- **Admin**: admin@example.com / admin123
- **Agent**: agent1@example.com / agent123

## 📁 Project Structure

```
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layers
│   │   ├── contexts/       # React contexts
│   │   ├── utils/          # Helper functions
│   │   └── types/          # TypeScript definitions
│   └── public/
│       └── locales/        # i18n translation files
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Helper functions
│   │   └── scripts/        # Database scripts
│   └── prisma/             # Database schema
├── worker/                  # Background job processing
│   └── src/
│       ├── jobs/           # Job definitions
│       └── processors/     # Job processors
├── infra/                   # Infrastructure and deployment
│   ├── docker-compose.*.yml
│   ├── nginx/              # Nginx configurations
│   └── ssl/                # SSL certificates
├── migrations/              # Database migrations
├── seeds/                   # Seed data scripts
└── docs/                    # Documentation
```

## 🔧 Configuration

### Environment Variables

Key environment variables you need to configure:

```env
# Database
DATABASE_URL=postgresql://bankuser:password@localhost:5432/loan_recovery

# Authentication
JWT_SECRET=your-secret-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Email
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourcompany.com

# Payment Gateways
BKASH_WEBHOOK_SECRET=your-bkash-secret
NAGAD_WEBHOOK_SECRET=your-nagad-secret
```

### Supabase Setup (Recommended)

1. **Create Supabase Project**
   ```bash
   # Go to https://supabase.com
   # Create new project
   # Copy URL and keys to .env
   ```

2. **Configure Authentication**
   - Enable Email/Password authentication
   - Set up RLS policies
   - Configure email templates

3. **Storage Setup**
   ```sql
   -- Create storage bucket for proof images
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('proof-images', 'proof-images', false);
   
   -- Set up RLS policies
   CREATE POLICY "Users can upload proof images" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'proof-images');
   ```

### Database Migration

```bash
# Run migrations
cd backend
npm run migrate

# Seed demo data
npm run seed
```

## 🏗 Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev

# Build for production
npm run build
```

### Backend Development
```bash
cd backend
npm install
npm run dev

# Run tests
npm test

# Generate Prisma client
npx prisma generate
```

### Worker Development
```bash
cd worker
npm install
npm run dev
```

## 📱 Features

### Admin Portal
- **Dashboard**: Real-time metrics with collection rates and trends
- **Account Management**: Bulk import, assignment, and tracking
- **Collection Verification**: Approve/reject agent submissions
- **Agent Management**: Performance tracking and territory assignment
- **Bank Configuration**: Commission rules and SLA settings
- **Automated Reports**: Weekly XLSX generation and email delivery
- **Reconciliation**: Auto-match payments and bank deposits

### Agent PWA
- **Mobile-First Design**: Optimized for field work
- **Offline Capabilities**: Work without internet, sync when connected
- **Collection Submission**: Multiple payment types with proof upload
- **Visit Tracking**: Log customer interactions with GPS
- **Account Management**: View assigned accounts and histories

### Automation
- **Payment Gateway Integration**: bKash and Nagad webhooks
- **SLA Monitoring**: Automated alerts for missed deadlines
- **Background Jobs**: Report generation and reconciliation
- **Email Notifications**: Stakeholder updates and alerts

## 🧪 Testing

### Run Tests
```bash
# Backend unit tests
cd backend && npm test

# Frontend component tests
cd frontend && npm test

# E2E tests
cd frontend && npm run cypress:run
```

### Test Coverage
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

## 🚀 Deployment

### Production Deployment

1. **Prepare Environment**
   ```bash
   # Copy production environment
   cp .env.example .env.production
   # Configure production values
   ```

2. **Deploy with Docker**
   ```bash
   # Build and start production services
   docker-compose -f infra/docker-compose.prod.yml up -d

   # Monitor logs
   docker-compose -f infra/docker-compose.prod.yml logs -f
   ```

3. **Set Up SSL**
   ```bash
   # Place SSL certificates in infra/ssl/
   # cert.pem and key.pem
   ```

### Cloud Deployment

#### Vercel (Frontend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

#### Railway/Render (Backend)
```bash
# Connect GitHub repository
# Set environment variables
# Deploy from main branch
```

#### Supabase (Database)
```bash
# Use Supabase hosted PostgreSQL
# Run migrations via Supabase dashboard
# Configure RLS policies
```

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (Admin/Agent/Auditor)
- Row-level security (RLS) policies
- Secure password hashing with bcrypt

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection headers
- File upload validation
- Rate limiting on API endpoints

### API Security
- CORS configuration
- Request signing for webhooks
- Secure file uploads with signed URLs
- API key management for external services

## 📊 Monitoring

### Application Monitoring
- Health check endpoints
- Structured logging with Pino
- Error tracking (optional Sentry integration)
- Performance monitoring

### Database Monitoring
- Connection pooling
- Query performance tracking
- Backup automation
- Migration tracking

## 🌐 Internationalization

The application supports English and বাংলা (Bengali):

- UI labels and messages
- Date and number formatting
- Currency display (৳ Taka)
- User preference persistence
- Right-to-left text support

## 📝 API Documentation

Interactive API documentation is available at:
- Development: http://localhost:3000/docs
- Production: https://yourdomain.com/api/docs

### Key API Endpoints

```bash
# Authentication
POST /auth/login
GET /auth/me
POST /auth/logout

# Accounts
GET /api/accounts
POST /api/accounts
PUT /api/accounts/:id
POST /api/accounts/:id/assign

# Collections
GET /api/collections
POST /api/collections
POST /api/collections/:id/verify

# Reports
GET /api/reports/weekly
POST /api/reports/generate

# Webhooks
POST /webhook/payment/bkash
POST /webhook/payment/nagad
```

## 🔄 Data Flow

### Collection Workflow
1. Agent submits collection with proof
2. Collection stored as "PENDING"
3. Admin verifies and approves/rejects
4. Approved collections update account balance
5. Auto-reconciliation with payment gateways
6. Weekly reports generated and emailed

### Import Workflow
1. Admin uploads CSV/XLSX file
2. System previews and validates data
3. Column mapping configuration
4. Batch processing with deduplication
5. Account creation/updates
6. Assignment to agents

## 🛠 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check PostgreSQL service
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up postgres
```

**Frontend Build Errors**
```bash
# Clear cache
cd frontend
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run build
```

**Worker Not Processing Jobs**
```bash
# Check Redis connection
docker-compose logs redis

# Restart worker
docker-compose restart worker

# Monitor job queue
docker-compose exec redis redis-cli monitor
```

### Performance Optimization

**Database**
- Regular VACUUM and ANALYZE
- Index optimization
- Connection pooling
- Query optimization

**Frontend**
- Code splitting
- Image optimization
- Caching strategies
- Bundle analysis

**Backend**
- Response compression
- Database query optimization
- Background job optimization
- Memory management

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write unit tests for new features
- Update documentation
- Follow conventional commit messages
- Ensure mobile responsiveness

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For technical support:
- Create an issue on GitHub
- Email: support@bankrecovery.com
- Documentation: [Wiki](link-to-wiki)

---

Built with ❤️ for efficient loan recovery management

## 📸 Screenshots

### Admin Dashboard
![Admin Dashboard](docs/screenshots/admin-dashboard.png)

### Agent Mobile Interface
![Agent PWA](docs/screenshots/agent-pwa.png)

### Collection Verification
![Collection Verification](docs/screenshots/collection-verification.png)

---

*Last updated: $(date)*