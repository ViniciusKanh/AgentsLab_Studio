# Publica o AgentsLab_Studio no GitHub (executar no PowerShell, na raiz do projeto).
#   cd C:\dev\AgentsLab_Studio
#   powershell -ExecutionPolicy Bypass -File .\scripts\publicar-github.ps1
# Requer: Git instalado e login no GitHub (Git Credential Manager ou `gh auth login`).
$ErrorActionPreference = "Stop"
$remote = "https://github.com/ViniciusKanh/AgentsLab_Studio.git"

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}
if (-not (git remote) -contains "origin") {
    git remote add origin $remote
}

# Segurança: garante que nenhum .env com segredo seja enviado
$envs = git ls-files --others --exclude-standard | Select-String -Pattern "\.env$"
if ($envs) { Write-Error "Arquivos .env não ignorados encontrados: $envs" }

git add .
git commit -m "feat: AgentsLab_Studio - mundo virtual imersivo, agentes autônomos e CI" 2>$null
git push -u origin main
Write-Host "Publicado em $remote" -ForegroundColor Green
Write-Host "Acompanhe as Actions em https://github.com/ViniciusKanh/AgentsLab_Studio/actions"
