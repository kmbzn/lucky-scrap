# Keep the alternate entry point on the same lossless extraction pipeline.
from pathlib import Path
import subprocess
subprocess.run(["node", str(Path(__file__).with_name("crop-icons.mjs"))], check=True)
