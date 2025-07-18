# 🚀 One-Click Deployment Guide

## Quick Start

### Full Deployment (Recommended)
```bash
./one-click-deploy.sh
```
**Use this when:** Making significant changes, first deployment, or when you want full verification.

### Quick Deployment (Fast)
```bash
./quick-deploy.sh
```
**Use this when:** Making small code changes and need fast iteration.

## What Each Script Does

### 🎯 `one-click-deploy.sh` - Full Deployment
- ✅ Comprehensive file preparation
- ✅ Optimized Docker image with health checks
- ✅ Security features (non-root user)
- ✅ Resource limits (memory, CPU)
- ✅ Full verification and testing
- ✅ Automatic cleanup of old images
- ✅ Detailed status reporting
- ⏱️ Takes ~2-3 minutes

### ⚡ `quick-deploy.sh` - Fast Deployment  
- ✅ Minimal file copying
- ✅ Basic Docker image
- ✅ Simple health check
- ✅ Fast iteration
- ⏱️ Takes ~30-60 seconds

## Deployment Workflow

1. **Make your code changes** in the `src/` directory
2. **Choose your deployment method:**
   - For major changes: `./one-click-deploy.sh`
   - For quick fixes: `./quick-deploy.sh`
3. **Wait for completion** - the script will show you the status
4. **Test your application** using the provided URLs

## Application URLs

After deployment, your application will be available at:

- **🌐 Main Application:** http://52.77.38.199
- **❤️ Health Check:** http://52.77.38.199/processor/health  
- **📄 Document API:** http://52.77.38.199/processor/document (POST)

## Quick Test Commands

```bash
# Test health endpoint
curl http://52.77.38.199/processor/health

# Test document processing (example)
curl -X POST http://52.77.38.199/processor/document \
  -H 'Content-Type: application/json' \
  -d '{"documentUrl": "https://example.com/doc.pdf"}'
```

## Troubleshooting

### If deployment fails:
1. Check if you're in the `terraform/` directory
2. Ensure your source code is in the parent `../src/` directory
3. Verify the EC2 instance is running: `terraform output`
4. Check SSH key permissions: `ls -la ~/.ssh/document-processing-key`

### If application doesn't respond:
1. Run `./fix-routes.sh` to diagnose issues
2. Check container logs on the server:
   ```bash
   ssh -i ~/.ssh/document-processing-key ubuntu@52.77.38.199
   sudo docker logs document-processor
   ```

### Force redeploy:
```bash
# Stop everything and redeploy
./redeploy-app.sh
```

## Development Workflow

1. **Edit code** in your local `src/` directory
2. **Quick test locally** (optional)
3. **Deploy changes:** `./quick-deploy.sh`
4. **Test on server:** Visit the health endpoint
5. **Repeat** as needed

For major changes or releases, use `./one-click-deploy.sh` for full verification.

## Files Created

- `one-click-deploy.sh` - Comprehensive deployment with full verification
- `quick-deploy.sh` - Fast deployment for quick iterations  
- `simple-fix.sh` - Nginx configuration fixes
- `redeploy-app.sh` - Force redeploy with cleanup
- `fix-routes.sh` - Route diagnostics

Happy coding! 🎉 