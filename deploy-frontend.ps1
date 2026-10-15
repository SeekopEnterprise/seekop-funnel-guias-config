$BUCKET = "guias-dev.sicopweb.com"
$CF_ID   = "E2BHL27O8OOO3K"
$DIST    = "$PSScriptRoot\frontend\dist"

# URL de la API del ambiente; se incrusta en el build
$env:VITE_API_URL = "https://api.sicopweb.com/guiasfunnel-dev"

Write-Host "==> Build..."
Set-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build fallido"; exit 1 }

Write-Host "==> Subiendo assets (JS/CSS) a s3://$BUCKET ..."
aws s3 sync "$DIST" "s3://$BUCKET" --delete --cache-control "max-age=31536000,immutable" --exclude "*.html"

Write-Host "==> Subiendo HTML (no-cache) ..."
aws s3 cp "$DIST\index.html" "s3://$BUCKET/index.html" --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"
aws s3 cp "$DIST\index-parent.html" "s3://$BUCKET/index-parent.html" --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"

Write-Host "==> Invalidando CloudFront ($CF_ID)..."
aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"

Write-Host "==> Listo."
Write-Host "    URL del modulo en Orbit : https://guias-dev.sicopweb.com/index-parent.html"
Write-Host "    (GuiasFunnel SPA embebida: https://guias-dev.sicopweb.com/index.html)"
Set-Location $PSScriptRoot
