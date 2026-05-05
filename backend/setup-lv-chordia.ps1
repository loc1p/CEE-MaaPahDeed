param(
  [switch]$CpuOnly
)

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $BackendDir ".venv-lvchordia"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $BackendDir "ml\requirements.txt"

Set-Location $BackendDir

if (!(Test-Path $PythonExe)) {
  Write-Host "Creating lv-chordia Python environment..."
  try {
    py -3.12 -m venv $VenvDir
  } catch {
    python -m venv $VenvDir
  }
}

& $PythonExe -m ensurepip --upgrade
& $PythonExe -m pip install --upgrade pip setuptools wheel

$HasNvidia = $false
try {
  nvidia-smi | Out-Null
  $HasNvidia = $true
} catch {
  $HasNvidia = $false
}

if ($HasNvidia -and -not $CpuOnly) {
  Write-Host "NVIDIA GPU detected. Installing CUDA PyTorch wheel when available..."
  try {
    & $PythonExe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
  } catch {
    Write-Warning "CUDA PyTorch install failed. Continuing with standard requirements."
  }
}

& $PythonExe -m pip install -r $Requirements

& $PythonExe -c "import torch, lv_chordia; print('lv-chordia ready'); print('cuda_available=', torch.cuda.is_available()); print('device=', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
