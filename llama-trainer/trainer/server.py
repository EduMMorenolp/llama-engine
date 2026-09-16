"""
llama-trainer server — API for fine-tuning, conversion, and quantization.
"""

import argparse
import json
import os
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global state
DATA_DIR = "/data"
MODELS_DIR = "/models"
TRAINING_JOBS: dict[str, dict] = {}
QUANTIZE_JOBS: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

@app.route("/api/datasets", methods=["GET"])
def list_datasets():
    ds_dir = Path(DATA_DIR) / "datasets"
    ds_dir.mkdir(parents=True, exist_ok=True)
    datasets = []
    for f in sorted(ds_dir.glob("*.jsonl")):
        count = sum(1 for _ in f.open())
        datasets.append({
            "id": f.stem,
            "name": f.name,
            "examples": count,
            "format": detect_format(f),
            "sizeBytes": f.stat().st_size,
        })
    return jsonify({"datasets": datasets})


@app.route("/api/datasets", methods=["POST"])
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename"}), 400

    ds_dir = Path(DATA_DIR) / "datasets"
    ds_dir.mkdir(parents=True, exist_ok=True)

    filename = file.filename
    if not filename.endswith((".jsonl", ".json")):
        return jsonify({"error": "File must be .jsonl or .json"}), 400

    save_path = ds_dir / filename
    file.save(str(save_path))

    count = sum(1 for _ in save_path.open())
    return jsonify({
        "id": save_path.stem,
        "name": filename,
        "examples": count,
        "format": detect_format(save_path),
        "sizeBytes": save_path.stat().st_size,
    })


@app.route("/api/datasets/<dataset_id>", methods=["DELETE"])
def delete_dataset(dataset_id: str):
    ds_dir = Path(DATA_DIR) / "datasets"
    for ext in (".jsonl", ".json"):
        p = ds_dir / f"{dataset_id}{ext}"
        if p.exists():
            p.unlink()
            return jsonify({"ok": True})
    return jsonify({"error": "Dataset not found"}), 404


@app.route("/api/datasets/<dataset_id>/validate", methods=["GET"])
def validate_dataset(dataset_id: str):
    ds_dir = Path(DATA_DIR) / "datasets"
    for ext in (".jsonl", ".json"):
        p = ds_dir / f"{dataset_id}{ext}"
        if p.exists():
            return jsonify(validate_file(p))
    return jsonify({"error": "Dataset not found"}), 404


def detect_format(path: Path) -> str:
    try:
        with path.open() as f:
            line = f.readline().strip()
            if not line:
                return "empty"
            obj = json.loads(line)
            if "conversations" in obj:
                return "ShareGPT"
            if "messages" in obj:
                return "OpenAI"
            if "instruction" in obj:
                return "Alpaca"
    except Exception:
        pass
    return "unknown"


def validate_file(path: Path) -> dict:
    errors = []
    examples = 0
    fmt = "unknown"
    with path.open() as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                examples += 1
                if fmt == "unknown":
                    fmt = detect_format_string(obj)
                if examples <= 3:
                    err = validate_example(obj, fmt)
                    if err:
                        errors.append(f"Line {i}: {err}")
            except json.JSONDecodeError:
                errors.append(f"Line {i}: Invalid JSON")
    return {"valid": len(errors) == 0, "format": fmt, "examples": examples, "errors": errors}


def detect_format_string(obj: dict) -> str:
    if "conversations" in obj:
        return "ShareGPT"
    if "messages" in obj:
        return "OpenAI"
    if "instruction" in obj:
        return "Alpaca"
    return "unknown"


def validate_example(obj: dict, fmt: str) -> Optional[str]:
    if fmt == "ShareGPT":
        convs = obj.get("conversations")
        if not isinstance(convs, list) or len(convs) == 0:
            return "Missing or empty 'conversations'"
    elif fmt == "OpenAI":
        msgs = obj.get("messages")
        if not isinstance(msgs, list) or len(msgs) == 0:
            return "Missing or empty 'messages'"
    elif fmt == "Alpaca":
        if not obj.get("instruction"):
            return "Missing 'instruction'"
    return None


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

@app.route("/api/train/start", methods=["POST"])
def start_training():
    data = request.get_json(force=True)
    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "status": "pending",
        "progress": 0,
        "epoch": 0,
        "totalEpochs": data.get("epochs", 3),
        "loss": 0,
        "config": data,
        "logs": [],
    }
    TRAINING_JOBS[job_id] = job

    thread = threading.Thread(target=run_training, args=(job_id,), daemon=True)
    thread.start()

    return jsonify({"jobId": job_id})


@app.route("/api/train/jobs", methods=["GET"])
def list_train_jobs():
    jobs = list(TRAINING_JOBS.values())
    return jsonify({"jobs": jobs})


@app.route("/api/train/jobs/<job_id>", methods=["GET"])
def get_train_job(job_id: str):
    job = TRAINING_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/train/jobs/<job_id>/stop", methods=["POST"])
def stop_train_job(job_id: str):
    job = TRAINING_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    job["status"] = "stopped"
    return jsonify({"ok": True})


def run_training(job_id: str):
    job = TRAINING_JOBS[job_id]
    config = job["config"]
    job["status"] = "running"

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer, SFTConfig
        from datasets import load_dataset

        base_model = config.get("baseModelId", "")
        dataset_id = config.get("datasetId", "")
        method = config.get("method", "qlora")
        epochs = config.get("epochs", 3)
        lr = config.get("learningRate", 2e-4)
        rank = config.get("rank", 64)
        batch_size = config.get("batchSize", 4)
        max_seq_len = config.get("maxSeqLen", 2048)

        output_dir = f"/data/output/{job_id}"
        os.makedirs(output_dir, exist_ok=True)

        job["logs"].append(f"Starting training with {method} method")
        job["logs"].append(f"Base model: {base_model}")
        job["logs"].append(f"Dataset: {dataset_id}")

        # 1. Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(base_model)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        # 2. Load model with optional quantization
        if method == "qlora":
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
            )
            model = AutoModelForCausalLM.from_pretrained(
                base_model, quantization_config=bnb_config, device_map="auto"
            )
            model = prepare_model_for_kbit_training(model)
        else:
            model = AutoModelForCausalLM.from_pretrained(
                base_model, torch_dtype=torch.bfloat16, device_map="auto"
            )

        # 3. Apply LoRA (for qlora and lora)
        if method in ("qlora", "lora"):
            lora_config = LoraConfig(
                r=rank,
                lora_alpha=rank * 2,
                target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                 "gate_proj", "up_proj", "down_proj"],
                lora_dropout=0.05,
                bias="none",
                task_type="CAUSAL_LM",
            )
            model = get_peft_model(model, lora_config)
            model.print_trainable_parameters()

        # 4. Load dataset
        dataset_path = f"{DATA_DIR}/datasets/{dataset_id}.jsonl"
        dataset = load_dataset("json", data_files=dataset_path, split="train")

        # 5. Format dataset for SFT
        def format_chat(example):
            if "messages" in example:
                text = tokenizer.apply_chat_template(example["messages"], tokenize=False)
            elif "conversations" in example:
                messages = [{"role": c["from"], "content": c["value"]}
                           for c in example["conversations"]]
                text = tokenizer.apply_chat_template(messages, tokenize=False)
            elif "instruction" in example:
                text = f"User: {example['instruction']}\nAssistant: {example.get('output', '')}"
            else:
                text = str(example)
            return {"text": text}

        dataset = dataset.map(format_chat)

        # 6. Configure trainer
        training_args = SFTConfig(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            learning_rate=lr,
            max_seq_length=max_seq_len,
            logging_steps=10,
            save_strategy="epoch",
            bf16=True,
            report_to="none",
        )

        trainer = SFTTrainer(
            model=model,
            args=training_args,
            train_dataset=dataset,
            tokenizer=tokenizer,
            dataset_text_field="text",
        )

        # 7. Train with callback for progress and stop support
        from transformers import TrainerCallback

        class ProgressCallback(TrainerCallback):
            def on_log(self, args, state, control, logs=None, **kwargs):
                if logs and "loss" in logs:
                    job["loss"] = logs["loss"]
                    job["epoch"] = state.epoch or 0
                    job["progress"] = int((state.epoch / epochs) * 100) if state.epoch else 0
                if job["status"] == "stopped":
                    control.should_training_stop = True

        trainer.add_callback(ProgressCallback())
        trainer.train()

        if job["status"] == "stopped":
            job["logs"].append("Entrenamiento detenido por el usuario")
        else:
            job["logs"].append("Training completed successfully!")
            job["modelPath"] = output_dir

    except Exception as e:
        job["status"] = "failed"
        job["logs"].append(f"Error: {str(e)}")


# ---------------------------------------------------------------------------
# Quantization
# ---------------------------------------------------------------------------

@app.route("/api/quantize/methods", methods=["GET"])
def get_quantize_methods():
    methods = [
        {"id": "Q3_K_M", "name": "Q3_K_M", "bits": 3.74, "size7b": "~3.5 GB", "quality": "★★★☆☆"},
        {"id": "Q4_K_M", "name": "Q4_K_M", "bits": 4.58, "size7b": "~4.3 GB", "quality": "★★★★☆"},
        {"id": "Q5_K_M", "name": "Q5_K_M", "bits": 5.33, "size7b": "~5.0 GB", "quality": "★★★★★"},
        {"id": "Q6_K", "name": "Q6_K", "bits": 6.14, "size7b": "~5.8 GB", "quality": "★★★★★"},
        {"id": "Q8_0", "name": "Q8_0", "bits": 8.50, "size7b": "~8.0 GB", "quality": "★★★★★"},
    ]
    return jsonify({"methods": methods})


@app.route("/api/quantize", methods=["POST"])
def quantize_model():
    data = request.get_json(force=True)
    model_id = data.get("modelId", "")
    method = data.get("method", "Q4_K_M")
    use_imatrix = data.get("imatrix", False)

    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id,
        "status": "running",
        "modelId": model_id,
        "method": method,
    }
    QUANTIZE_JOBS[job_id] = job

    thread = threading.Thread(target=run_quantize, args=(job_id, model_id, method, use_imatrix), daemon=True)
    thread.start()

    return jsonify({"jobId": job_id, "status": "running"})


@app.route("/api/quantize/jobs/<job_id>", methods=["GET"])
def get_quantize_job(job_id: str):
    job = QUANTIZE_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


def run_quantize(job_id: str, model_id: str, method: str, use_imatrix: bool):
    job = QUANTIZE_JOBS[job_id]
    try:
        input_path = Path(MODELS_DIR) / f"{model_id}.gguf"
        if not input_path.exists():
            # Check if it's an HF model in output
            input_path = Path("/data/output") / model_id / "adapter_model.safetensors"
            if not input_path.exists():
                job["status"] = "failed"
                job["error"] = f"Model {model_id} not found"
                return

        output_path = Path(MODELS_DIR) / f"{model_id}-{method}.gguf"

        # If HF model, convert first
        if input_path.suffix == ".safetensors":
            gguf_path = Path("/data/output") / f"{model_id}-f16.gguf"
            subprocess.run([
                "python3", "/usr/local/bin/convert_hf_to_gguf.py",
                str(input_path.parent),
                "--outtype", "f16",
                "--outfile", str(gguf_path),
            ], check=True)
            input_path = gguf_path

        # Quantize
        cmd = ["llama-quantize"]
        if use_imatrix:
            imatrix_path = Path("/data/output") / f"{job_id}_imatrix.dat"
            # Generate imatrix first
            subprocess.run([
                "llama-imatrix",
                "-m", str(input_path),
                "-f", "/workspace/calibration.txt",
                "-ngl", "99",
                "-o", str(imatrix_path),
            ], check=True)
            cmd.extend(["--imatrix", str(imatrix_path)])

        cmd.extend([
            str(input_path),
            str(output_path),
            method,
        ])

        subprocess.run(cmd, check=True)

        job["status"] = "completed"
        job["inputPath"] = str(input_path)
        job["outputPath"] = str(output_path)
        job["inputSize"] = input_path.stat().st_size
        job["outputSize"] = output_path.stat().st_size

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

@app.route("/api/models/deploy", methods=["POST"])
def deploy_model():
    data = request.get_json(force=True)
    model_name = data.get("modelName", "")
    activate = data.get("activate", False)

    if not model_name:
        return jsonify({"error": "modelName required"}), 400

    source = Path(MODELS_DIR) / f"{model_name}.gguf"
    if not source.exists():
        return jsonify({"error": f"Model {model_name}.gguf not found in {MODELS_DIR}"}), 404

    if activate:
        target = Path(MODELS_DIR) / f"{model_name}.gguf"
        if target != source:
            try:
                import shutil
                if target.exists():
                    target.unlink()
                shutil.copy2(source, target)
            except Exception as e:
                return jsonify({"error": f"Failed to deploy: {str(e)}"}), 500

    return jsonify({
        "ok": True,
        "message": f"Modelo {model_name} desplegado en {MODELS_DIR}",
        "activate": activate,
    })


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "llama-trainer"})


def main():
    parser = argparse.ArgumentParser(description="llama-trainer server")
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--data-dir", default="/data")
    parser.add_argument("--models-dir", default="/models")
    args = parser.parse_args()

    global DATA_DIR, MODELS_DIR
    DATA_DIR = args.data_dir
    MODELS_DIR = args.models_dir

    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    Path(DATA_DIR, "datasets").mkdir(parents=True, exist_ok=True)
    Path(DATA_DIR, "base").mkdir(parents=True, exist_ok=True)
    Path(DATA_DIR, "output").mkdir(parents=True, exist_ok=True)
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)

    print(f"[llama-trainer] data: {DATA_DIR}")
    print(f"[llama-trainer] models: {MODELS_DIR}")
    app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()
