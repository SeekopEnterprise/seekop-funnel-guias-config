# Usa aws cloudformation package + deploy para evitar el error SSL de SAM
Set-Location $PSScriptRoot

Write-Host "==> sam build..."
sam build
if ($LASTEXITCODE -ne 0) { Write-Error "Build fallido"; exit 1 }

Write-Host "==> Empaquetando artefactos..."
aws cloudformation package `
    --template-file .aws-sam\build\template.yaml `
    --s3-bucket sicop-apps `
    --s3-prefix GUIASFUNNEL-dev `
    --output-template-file packaged.yaml `
    --no-verify-ssl

if ($LASTEXITCODE -ne 0) { Write-Error "Package fallido"; exit 1 }

Write-Host "==> Desplegando stack GUIASFUNNEL-dev..."
aws cloudformation deploy `
    --template-file packaged.yaml `
    --stack-name GUIASFUNNEL-dev `
    --capabilities CAPABILITY_NAMED_IAM `
    --no-verify-ssl

Write-Host "==> Listo. API: https://api.sicopweb.com/guiasfunnel-dev/"
