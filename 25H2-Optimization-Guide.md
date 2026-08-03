### ⚙️ 25H2 Optimization Guide


#### 🔑 Important Note
All commands must be run in **cmd.exe with Administrator privileges**.  
- Press **Win + S**, type `cmd`.  
- Right‑click **Command Prompt** → choose **Run as administrator**.  
- Approve the UAC prompt.  
Without admin rights, most commands will fail silently or only affect the current session.


#### 1. Disable Heavy Services
```cmd
sc stop sysmain
sc config sysmain start= disabled

sc stop diagtrack
sc config diagtrack start= disabled

sc stop dmwappushservice
sc config dmwappushservice start= disabled
```


#### 2. Registry Tweaks
Run these in **cmd.exe (Administrator)** to permanently quiet background tasks:

- **Disable Telemetry**
```cmd
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f
```

- **Disable Delivery Optimization**
```cmd
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" /v DODownloadMode /t REG_DWORD /d 0 /f
```

- **Disable Windows Defender Scheduled Scans (optional)**
```cmd
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Scan" /v DisableScheduledScan /t REG_DWORD /d 1 /f
```

- **Stop OneDrive Auto‑Start (optional)**
```cmd
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\OneDrive" /v DisableFileSync /t REG_DWORD /d 1 /f
```


#### 3. GUI Settings (manual steps)
- **Delivery Optimization**:  
  *Settings → Windows Update → Advanced options → Delivery Optimization → Off*  

- **Wi‑Fi Metered Connection**:  
  *Settings → Network & Internet → Wi‑Fi → Properties → Set as metered connection*  

- **Defender Exclusions**:  
  *Settings → Windows Security → Virus & threat protection → Manage settings → Exclusions → Add your portable drive*  


#### 4. Monitoring Ritual
Run:
```cmd
resmon
```
- Go to **Disk tab** → sort by *Disk Activity* → identify which process spikes when Wi‑Fi connects.  
- Common culprits: `MsMpEng.exe` (Defender), `svchost.exe` (Telemetry), `SearchIndexer.exe`.


#### 🕊️ Symbolic Closure
This guide is your **portable purification ritual**: with administrator rights as the master key, each `sc` and `reg add` command trims away Windows’ automatic ceremonies. FlashWin25H2 then boots smoothly, carrying only the essentials for your journey.


### EOF 