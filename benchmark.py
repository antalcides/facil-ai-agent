#!/usr/bin/env python3
"""
Benchmark Ollama · hardware 4 GB VRAM / 8 GB RAM
Requiere: pip install requests
"""

import requests
import time
import json
import sys

OLLAMA_URL = "http://localhost:11434"

# Nombres EXACTOS de los tags publicados en ollama.com
MODELS = [
    {"name": "qwen3.5:2b-q4_K_M",   "task": "general",      "prompt": "Explica en 3 frases que es la cuantizacion de modelos.", "ctx": 2048},
    {"name": "qwen2.5-coder:3b",    "task": "codigo",       "prompt": "Escribe una funcion en Python que calcule el maximo comun divisor.", "ctx": 2048},
    {"name": "qwen3:4b",            "task": "traduccion",   "prompt": "Traduce al espanol: 'The quick brown fox jumps over the lazy dog.'", "ctx": 1024},
    {"name": "deepseek-r1:1.5b",    "task": "razonamiento", "prompt": "Si un tren viaja a 80 km/h, cuanto tarda en recorrer 140 km?", "ctx": 2048},
]


def installed_models():
    """Devuelve el conjunto de modelos descargados localmente."""
    r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5).json()
    return {m["name"] for m in r.get("models", [])}


def check_gpu_residency(model):
    """Comprueba si el modelo esta residente al 100% en GPU."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/ps", timeout=5).json()
        base = model.split(":")[0]
        for m in r.get("models", []):
            if m["name"].startswith(base):
                size = m.get("size", 0)
                vram = m.get("size_vram", 0)
                return (vram / size * 100) if size else None
    except Exception:
        pass
    return None


def benchmark(model_name, prompt, num_ctx, n_runs=3):
    results = []

    for _ in range(n_runs):
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": True,
            "options": {
                "num_ctx": num_ctx,
                "temperature": 0.7,
                "num_predict": 200,
            },
        }

        t0 = time.perf_counter()
        first_token = None
        tokens = 0

        try:
            with requests.post(
                f"{OLLAMA_URL}/api/generate", json=payload, stream=True, timeout=240
            ) as r:
                if r.status_code == 404:
                    # El tag no existe localmente: leer el cuerpo del error
                    detail = r.text.strip() or "model not found"
                    return ("missing", detail)
                r.raise_for_status()

                for line in r.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    if data.get("response"):
                        if first_token is None:
                            first_token = time.perf_counter() - t0
                        tokens += 1
                    if data.get("done"):
                        break

        except requests.exceptions.ConnectionError:
            return ("error", "Ollama no responde en localhost:11434")
        except requests.exceptions.ReadTimeout:
            return ("error", "Timeout: el modelo tardo demasiado (posible spill a CPU)")

        total = time.perf_counter() - t0
        gen = total - (first_token or 0)
        tps = tokens / gen if gen > 0 else 0
        results.append((tps, first_token or 0, tokens))

    runs = results[1:] if len(results) > 1 else results
    avg_tps = sum(r[0] for r in runs) / len(runs)
    avg_ttft = sum(r[1] for r in runs) / len(runs)
    return ("ok", (avg_tps, avg_ttft, results[0][2]))


def main():
    print("=" * 64)
    print("  BENCHMARK OLLAMA  ·  4 GB VRAM / 8 GB RAM")
    print("=" * 64)

    try:
        have = installed_models()
    except requests.exceptions.ConnectionError:
        sys.exit("X  No hay conexion con Ollama. Arranca: ollama serve")

    print(f"\nModelos instalados ({len(have)}):")
    for n in sorted(have) or ["(ninguno)"]:
        print(f"  · {n}")

    # Avisar ANTES de medir de qué falta
    missing = [m["name"] for m in MODELS if m["name"] not in have]
    if missing:
        print("\n!  Faltan por descargar:")
        for m in missing:
            print(f"    ollama pull {m}")
        print()

    print(f"\n{'MODELO':<24}{'t/s':>7}{'1er tok':>10}{'GPU':>9}  TAREA")
    print("-" * 64)

    for m in MODELS:
        if m["name"] not in have:
            print(f"{m['name']:<24}{'—':>7}{'—':>10}{'—':>9}  omitido (no instalado)")
            continue

        print(f"\n> Midiendo {m['name']} ...", flush=True)
        status, out = benchmark(m["name"], m["prompt"], m["ctx"])

        if status != "ok":
            print(f"  {status.upper()}: {out}")
            continue

        tps, ttft, ntok = out
        gpu = check_gpu_residency(m["name"])
        gpu_str = f"{gpu:.0f}%" if gpu is not None else "?"
        if gpu is not None and gpu < 99:
            gpu_str += " !"

        print(f"{m['name']:<24}{tps:>7.1f}{ttft:>9.2f}s{gpu_str:>9}  {m['task']}")

    print("\n" + "=" * 64)
    print("Lectura de resultados:")
    print("  t/s por debajo del 50% del techo -> revisa contexto o navegador")
    print("  GPU < 99%                        -> derrame a CPU, baja num_ctx")
    print("  1er token > 3 s                  -> prompt eval lento")
    print("=" * 64)


if __name__ == "__main__":
    main()