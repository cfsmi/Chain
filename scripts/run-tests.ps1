param(
    [switch]$SkipLint
)

Write-Host "Running repo test script..."

Write-Host "[1/2] Building project with rbxtsc..."
$build = npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Fix compiler errors before running tests."
    exit $LASTEXITCODE
}

if (-not $SkipLint) {
    Write-Host "[2/2] Running ESLint for TypeScript files..."
    npx eslint . --ext .ts --max-warnings=0
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Lint failed. Fix ESLint issues before running tests."
        exit $LASTEXITCODE
    }
}

Write-Host "✅ Repo test script completed successfully."
