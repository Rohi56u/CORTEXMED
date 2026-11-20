import os
import sys
import shutil
import subprocess
import argparse
from pathlib import Path

def verify_onnx_model(target_file: Path) -> bool:
    import onnx
    print(f"Running integrity verification on {target_file}...")
    if not target_file.exists():
        print(f"ERROR: {target_file} does not exist!")
        return False

    file_size_bytes = target_file.stat().st_size
    file_size_mb = file_size_bytes / (1024 * 1024)
    print(f"ONNX Model File Size: {file_size_bytes} bytes ({file_size_mb:.2f} MB)")
    if file_size_mb < 10.0:
        print(f"ERROR: Model file size ({file_size_mb:.2f} MB) is smaller than 10 MB!")
        return False

    onnx_model = onnx.load(str(target_file))
    onnx.checker.check_model(onnx_model)
    print("ONNX Model Checker passed.")

    graph = onnx_model.graph
    inputs = graph.input
    outputs = graph.output

    print(f"Inputs count: {len(inputs)}")
    for inp in inputs:
        inp_shape = [dim.dim_value for dim in inp.type.tensor_type.shape.dim]
        elem_type = inp.type.tensor_type.elem_type
        print(f"  Input name: {inp.name}, shape: {inp_shape}, elem_type: {elem_type}")
        if inp_shape != [1, 3, 640, 640]:
            print(f"ERROR: Unexpected input shape: {inp_shape}, expected [1, 3, 640, 640]")
            return False

    print(f"Outputs count: {len(outputs)}")
    for out in outputs:
        out_shape = [dim.dim_value for dim in out.type.tensor_type.shape.dim]
        elem_type = out.type.tensor_type.elem_type
        print(f"  Output name: {out.name}, shape: {out_shape}, elem_type: {elem_type}")
        if out_shape != [1, 84, 8400]:
            print(f"ERROR: Unexpected output shape: {out_shape}, expected [1, 84, 8400]")
            return False

    print("ALL INTEGRITY CHECKS PASSED: Model is authentic YOLOv8n ONNX with [1, 3, 640, 640] -> [1, 84, 8400].")
    return True

def main():
    parser = argparse.ArgumentParser(description="Export and verify YOLOv8n ONNX model for CortexMed.")
    parser.add_argument("--force", action="store_true", help="Force re-export even if valid ONNX exists")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing ONNX model")
    args = parser.parse_args()

    root_dir = Path(__file__).resolve().parent.parent
    target_dir = root_dir / "mira-chat" / "public" / "models"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "yolov8n.onnx"

    print(f"Target destination: {target_file}")

    # Ensure onnx is available for checking
    try:
        import onnx
    except ImportError:
        print("Installing onnx...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "onnx"])
        import onnx

    if not args.force and target_file.exists():
        try:
            if verify_onnx_model(target_file):
                print("Valid YOLOv8n ONNX model already exists. Skipping export.")
                return
        except Exception as e:
            print(f"Existing model check failed ({e}). Proceeding to export...")

    if args.verify_only:
        if not verify_onnx_model(target_file):
            sys.exit(1)
        return

    # Ensure ultralytics is available
    try:
        import ultralytics
    except ImportError:
        print("Installing ultralytics...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "ultralytics"])
        import ultralytics

    from ultralytics import YOLO

    print("Exporting YOLOv8n to ONNX format (imgsz=640, opset=12)...")
    temp_pt = root_dir / "yolov8n.pt"

    # Pre-download with headers if pt missing to avoid 403 blocks from GitHub assets
    if not temp_pt.exists():
        pt_url = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt"
        try:
            import urllib.request
            req = urllib.request.Request(pt_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp, open(str(temp_pt), "wb") as f:
                shutil.copyfileobj(resp, f)
            print("Successfully fetched yolov8n.pt")
        except Exception as e:
            print(f"Direct download fallback note: {e}")

    model = YOLO(str(temp_pt) if temp_pt.exists() else "yolov8n.pt")
    exported_path = model.export(format="onnx", imgsz=640, opset=12)
    print(f"Exported to: {exported_path}")

    # Move to target location
    exported_p = Path(exported_path)
    if exported_p.resolve() != target_file.resolve():
        shutil.move(str(exported_p), str(target_file))

    # Clean up any temp .pt file
    if temp_pt.exists():
        try:
            temp_pt.unlink()
            print("Cleaned up temporary yolov8n.pt")
        except Exception as e:
            print(f"Warning: could not delete {temp_pt}: {e}")

    # Run verification check
    if not verify_onnx_model(target_file):
        sys.exit(1)

if __name__ == "__main__":
    main()

