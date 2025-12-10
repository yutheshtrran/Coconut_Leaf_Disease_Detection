$uri = 'http://localhost:5000/api/auth'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host '--- Register ---'
$body = @{username = 'smoketest'; email = 'smoketest@example.com'; password = 'Secret123' } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Method Post -Uri "$uri/register" -Body $body -ContentType 'application/json' -WebSession $s
    Write-Host 'Register response:'
    $r | ConvertTo-Json -Depth 5
}
catch {
    Write-Host 'Register error:' $_.Exception.Message
}
Write-Host '--- Note: verification required ---'
Write-Host 'The test does not auto-verify users. If you want to test verification, click the link in the verification email or use the /auth/resend endpoint to send a new verification email.'

Write-Host '--- Login ---'
$body = @{ emailOrUsername = 'smoketest'; password = 'Secret123' } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Method Post -Uri "$uri/login" -Body $body -ContentType 'application/json' -WebSession $s
    Write-Host 'Login response:'
    $r | ConvertTo-Json -Depth 5
}
catch {
    Write-Host 'Login error:' $_.Exception.Message
}

Write-Host '--- Me ---'
try {
    $r = Invoke-RestMethod -Method Get -Uri "$uri/me" -WebSession $s
    Write-Host 'Me response:'
    $r | ConvertTo-Json -Depth 5
}
catch {
    Write-Host 'Me error:' $_.Exception.Message
}

Write-Host '--- Refresh ---'
try {
    $r = Invoke-RestMethod -Method Post -Uri "$uri/refresh" -WebSession $s
    Write-Host 'Refresh response:'
    $r | ConvertTo-Json -Depth 5
}
catch {
    Write-Host 'Refresh error:' $_.Exception.Message
}

Write-Host '--- Logout ---'
try {
    $r = Invoke-RestMethod -Method Post -Uri "$uri/logout" -WebSession $s
    Write-Host 'Logout response:'
    $r | ConvertTo-Json -Depth 5
}
catch {
    Write-Host 'Logout error:' $_.Exception.Message
}

Write-Host '--- Forgot (password) ---'
try {
    $body = @{ email = 'smoketest@example.com' } | ConvertTo-Json
    $r = Invoke-RestMethod -Method Post -Uri "$uri/forgot" -Body $body -ContentType 'application/json' -WebSession $s
    Write-Host 'Forgot response:'
    $r | ConvertTo-Json -Depth 5
    $token = $r.resetToken
}
catch {
    Write-Host 'Forgot error:' $_.Exception.Message
}

if ($token) {
    Write-Host '--- Reset (using token returned in dev) ---'
    try {
        $body = @{ token = $token; password = 'NewSecret123' } | ConvertTo-Json
        $r = Invoke-RestMethod -Method Post -Uri "$uri/reset" -Body $body -ContentType 'application/json' -WebSession $s
        Write-Host 'Reset response:'
        $r | ConvertTo-Json -Depth 5
    }
    catch {
        Write-Host 'Reset error:' $_.Exception.Message
    }
}
