# Publica o AgentsLab_Studio no GitHub (executar no PowerShell, na raiz do projeto).
#   cd C:\dev\AgentsLab_Studio
#   powershell -ExecutionPolicy Bypass -File .\scripts\publicar-github.ps1 -Mensagem "feat: ..."
# Requer: Git instalado e login no GitHub (Git Credential Manager ou `gh auth login`).
param([string]$Mensagem = "feat: plataforma de organizações multiagentes")
$ErrorActionPreference = "Stop"
$remote = "https://github.com/ViniciusKanh/AgentsLab_Studio.git"

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}
if (-not ((git remote) -contains "origin")) {
    git remote add origin $remote
}

# Segurança: nenhum .env, banco local ou cofre de segredos pode ser enviado
$sensiveis = git ls-files --others --cached --exclude-standard | Select-String -Pattern "(\.env$|secrets\.enc$|\.db$)"
if ($sensiveis) { Write-Error "Arquivos sensíveis seriam enviados: $sensiveis" }

git add .
# Mensagem gravada em arquivo UTF-8 (sem BOM): evita acentos corrompidos no histórico
$arquivo = Join-Path $env:TEMP "agentslab-commit-msg.txt"
[System.IO.File]::WriteAllText($arquivo, $Mensagem, (New-Object System.Text.UTF8Encoding($false)))
git -c i18n.commitEncoding=utf-8 commit -F $arquivo
Remove-Item $arquivo
git push -u origin main
Write-Host "Publicado em $remote" -ForegroundColor Green
Write-Host "Acompanhe as Actions em https://github.com/ViniciusKanh/AgentsLab_Studio/actions"
