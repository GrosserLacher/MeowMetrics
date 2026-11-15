import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tests"))
# Die Haupt-Datenbank der Tests liegt in einem temporären Ordner (vor dem Import der App festlegen)
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="mm-test-")
