$ErrorActionPreference='Stop'
$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path '../.tools/playwright-browsers').Path
for ($round=1; $round -le 3; $round++) {
 $env:QA_ROUND=[string]$round
 New-Item -ItemType Directory -Force "_qa/live-round-$round" | Out-Null
 foreach ($test in @('verify','interactions','theme-copy','readability','check-theme-apply-all','palettes')) {
  $output = & node -r ./preview/live-test-hook.cjs "preview/$test.cjs" 2>&1
  $exit=$LASTEXITCODE
  $output | Set-Content -Encoding utf8 "_qa/live-round-$round/$test.log"
  if ($exit -ne 0) { throw "Round $round $test failed: $output" }
  if ($test -eq 'verify') { $r=Get-Content _qa/report.json -Raw | ConvertFrom-Json; if ($r.errors.Count -gt 0 -or $r.liveRequests.Count -gt 0 -or ($r.results | Where-Object overflow)) { throw 'Full page verification errors' }; Copy-Item _qa/report.json "_qa/live-round-$round/verify.json" }
  Write-Output "Round $round : $test PASS"
 }
 & node preview/live-smoke.cjs
 if ($LASTEXITCODE -ne 0) { throw "Live smoke round $round failed" }
 Write-Output "ROUND $round COMPLETE"
}
