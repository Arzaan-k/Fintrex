# Fintrex Deployment Guide

## 🚀 Deployment Options

This guide covers multiple deployment options for the Fintrex application.

## Prerequisites

Before deploying, ensure you have:
- ✅ Supabase project set up with all tables created
- ✅ Environment variables configured
- ✅ (Optional) Gemini API key for AI features
- ✅ (Optional) WhatsApp Business API credentials
- ✅ (Optional) Email service configured

## 1. Vercel Deployment (Recommended)

Vercel provides zero-config deployment with automatic CI/CD.

### Steps:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Configure Environment Variables**
   
   Go to Vercel Dashboard → Project → Settings → Environment Variables
   
   Add all variables from `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_GEMINI_API_KEY` (optional)
   - `VITE_BACKEND_URL` (optional)
   - `VITE_WHATSAPP_PROXY_URL` (optional)

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

### Automatic GitHub Deployment

1. Push your code to GitHub
2. Connect repository to Vercel
3. Vercel will auto-deploy on every push to main branch

## 2. Netlify Deployment

### Steps:

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

3. **Login to Netlify**
   ```bash
   netlify login
   ```

4. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Configuration

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

## 3. AWS Deployment

### Option A: S3 + CloudFront

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://fintrex-app
   ```

3. **Upload files**
   ```bash
   aws s3 sync dist/ s3://fintrex-app --delete
   ```

4. **Configure S3 for static website hosting**
   ```bash
   aws s3 website s3://fintrex-app --index-document index.html --error-document index.html
   ```

5. **Create CloudFront Distribution**
   - Point to S3 bucket
   - Configure SSL certificate
   - Set custom error responses (404 → /index.html)

### Option B: Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB application**
   ```bash
   eb init -p node.js fintrex-app
   ```

3. **Create environment**
   ```bash
   eb create fintrex-production
   ```

4. **Deploy**
   ```bash
   eb deploy
   ```

## 4. Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Build and Run

```bash
# Build image
docker build -t fintrex-app .

# Run container
docker run -d -p 80:80 --name fintrex fintrex-app
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## 5. Digital Ocean App Platform

1. **Connect GitHub repository**
2. **Configure build settings**
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Add environment variables**
4. **Deploy**

## 6. Azure Static Web Apps

1. **Install Azure CLI**
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   swa deploy dist
   ```

## Environment Variables Configuration

### Production Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_PROJECT_ID=your_project_id

# AI Services (Optional)
VITE_GEMINI_API_KEY=your_gemini_key

# Backend Services (Optional)
VITE_BACKEND_URL=https://api.fintrex.in
VITE_WHATSAPP_PROXY_URL=https://whatsapp-api.fintrex.in
```

### Security Best Practices

1. **Never commit `.env` files**
   - Add `.env` to `.gitignore`
   - Use environment-specific files (`.env.production`, `.env.staging`)

2. **Use secrets management**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

3. **Rotate keys regularly**
   - API keys should be rotated every 90 days
   - Use different keys for different environments

## Database Migration

### Supabase Setup

1. **Create Supabase project**
2. **Run migrations**

```sql
-- Create tables (run in Supabase SQL Editor)
-- Copy SQL from supabase/migrations/
```

3. **Set up Row Level Security (RLS)**

```sql
-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Accountants can only see their own clients
CREATE POLICY "accountants_own_clients" ON clients
  FOR ALL USING (accountant_id = auth.uid());

-- Clients can only see their own data
CREATE POLICY "clients_own_data" ON clients
  FOR SELECT USING (id IN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
  ));
```

## Post-Deployment Checklist

### Functional Testing
- [ ] User registration and login
- [ ] Client creation and management
- [ ] Document upload and processing
- [ ] Financial statements generation
- [ ] GST report generation
- [ ] Email notifications
- [ ] Mobile responsiveness

### Performance Testing
- [ ] Page load times < 3 seconds
- [ ] Document processing < 60 seconds
- [ ] API response times < 500ms

### Security Testing
- [ ] Authentication flows
- [ ] Authorization checks
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection

### Monitoring Setup
1. **Error Tracking**: Set up Sentry or similar
2. **Analytics**: Configure Google Analytics or Plausible
3. **Uptime Monitoring**: Set up UptimeRobot or Pingdom
4. **Log Aggregation**: CloudWatch, Datadog, or New Relic

## Troubleshooting

### Build Failures

**Issue**: Build fails with "Cannot find module"
```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: TypeScript errors
```bash
# Solution: Check type definitions
npm install @types/node @types/react @types/react-dom --save-dev
```

### Runtime Issues

**Issue**: White screen after deployment
- Check browser console for errors
- Verify environment variables are set
- Ensure correct build output directory

**Issue**: API calls fail
- Verify Supabase URL and keys
- Check CORS settings
- Verify network connectivity

### Performance Issues

**Issue**: Slow page loads
- Enable gzip compression
- Implement code splitting
- Optimize images
- Use CDN for static assets

## Continuous Integration / Continuous Deployment (CI/CD)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Backup Strategy

### Database Backups
- Supabase provides automatic daily backups
- For additional security, set up daily exports:

```bash
# Backup script
pg_dump -h db.project.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

### Storage Backups
- Use Supabase CLI to backup storage:

```bash
supabase db dump > backup.sql
```

## Rollback Procedure

If deployment fails:

1. **Vercel**: Click "Rollback" in Vercel dashboard
2. **Docker**: Revert to previous image
   ```bash
   docker pull fintrex-app:previous-tag
   docker-compose up -d
   ```
3. **AWS**: Deploy previous version from S3 backup

## Support and Monitoring

### Health Check Endpoint

Create a health check for monitoring:

```typescript
// src/pages/health.tsx
export default function Health() {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Monitoring Tools

1. **Uptime**: UptimeRobot, Pingdom
2. **Performance**: Lighthouse CI, WebPageTest
3. **Errors**: Sentry, Rollbar
4. **Analytics**: Google Analytics, Plausible
5. **Logs**: CloudWatch, Datadog, Loggly

---

## Questions?

For deployment support, contact: devops@fintrex.in
