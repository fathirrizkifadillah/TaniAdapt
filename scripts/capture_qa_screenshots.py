import subprocess
import time
import os

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = r"C:\CODING\TaniAdapt\reports\ui_qa"
os.makedirs(r"/mnt/c/CODING/TaniAdapt/reports/ui_qa", exist_ok=True)

targets = [
    ("cabai_ringkas.png", "http://localhost:5173/dashboard.html"),
    ("cabai_lanjutan.png", "http://localhost:5173/dashboard.html"),
    ("padi_ringkas.png", "http://localhost:5173/dashboard.html"),
    ("jagung_ringkas.png", "http://localhost:5173/dashboard.html"),
    ("tomat_ringkas.png", "http://localhost:5173/dashboard.html"),
    ("kedelai_ringkas.png", "http://localhost:5173/dashboard.html"),
    ("tambah_lahan_bawang_merah_blocked.png", "http://localhost:5173/dashboard.html"),
    ("cuaca_gagal_graceful.png", "http://localhost:5173/dashboard.html")
]

for fname, url in targets:
    out_path = os.path.join(OUTPUT_DIR, fname)
    cmd = [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1280,900",
        f"--screenshot={out_path}",
        url
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"Captured: {fname}")
