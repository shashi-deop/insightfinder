# Quick Azure Deployment for Demo
Write-Host "🚀 Quick Azure Deployment for InsightFinder Demo" -ForegroundColor Green

# Set variables
$RESOURCE_GROUP = "insightfinder-demo-rg"
$LOCATION = "eastus"
$FRONTEND_APP = "insightfinder-frontend"
$BACKEND_APP = "insightfinder-backend"
$PLAN_NAME = "insightfinder-demo-plan"

Write-Host "📦 Creating resource group..." -ForegroundColor Yellow
az group create --name $RESOURCE_GROUP --location $LOCATION

Write-Host "📋 Creating app service plan (FREE tier)..." -ForegroundColor Yellow
az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP --location $LOCATION --sku F1 --is-linux

Write-Host "🌐 Creating frontend app service..." -ForegroundColor Yellow
az webapp create --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --runtime "NODE|18-lts"

Write-Host "🔧 Creating backend app service..." -ForegroundColor Yellow
az webapp create --name $BACKEND_APP --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --runtime "PYTHON|3.11"

Write-Host "⚙️ Configuring environment variables..." -ForegroundColor Yellow
az webapp config appsettings set --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --settings NEXT_PUBLIC_BACKEND_URL="https://$BACKEND_APP.azurewebsites.net"
az webapp config appsettings set --name $BACKEND_APP --resource-group $RESOURCE_GROUP --settings PORT="8000" CORS_ORIGIN="https://$FRONTEND_APP.azurewebsites.net"

Write-Host "📤 Deploying from GitHub..." -ForegroundColor Yellow
az webapp deployment source config --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --repo-url "https://github.com/shashi-deop/insightfinder" --branch main --manual-integration
az webapp deployment source config --name $BACKEND_APP --resource-group $RESOURCE_GROUP --repo-url "https://github.com/shashi-deop/insightfinder" --branch main --manual-integration --repository-type git

Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "🌐 Frontend URL: https://$FRONTEND_APP.azurewebsites.net" -ForegroundColor Cyan
Write-Host "🔧 Backend URL: https://$BACKEND_APP.azurewebsites.net" -ForegroundColor Cyan
Write-Host "📊 Azure Portal: https://portal.azure.com" -ForegroundColor Cyan
Write-Host "💰 Cost: FREE for 12 months!" -ForegroundColor Green 