#!/usr/bin/env python3
"""Run the official Tripo CLI as an img2threejs character reference adapter.

The Tripo CLI owns task submission, polling, retries, downloads, authentication,
and credit errors. This wrapper deliberately does not reimplement any of those.
It composes the documented CLI pipe contract and records local provenance before
handing the downloaded GLB to img2threejs's probe and rig-payload gate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any, Iterable, Optional


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
LOCAL_TRIPO_JS = HERE / "node_modules" / "tripo-cli" / "dist" / "cli.js"
IMG2THREEJS_ROOT = REPO_ROOT / "vendor" / "img2threejs"
DEFAULT_ANIMATIONS = (
    "preset:biped:idle",
    "preset:biped:walk",
    "preset:biped:victory_celebration",
)
TERMINAL_STATUSES = {"success", "failed", "cancelled", "banned", "expired"}


class WorkflowError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "character"


def find_node() -> Path:
    configured = os.environ.get("TRIPO_NODE")
    if configured:
        path = Path(configured).expanduser()
        if path.is_file():
            return path
        raise WorkflowError(f"TRIPO_NODE does not name a file: {path}")
    system = shutil.which("node")
    if system:
        return Path(system)
    codex = (
        Path.home()
        / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
    )
    if codex.is_file():
        return codex
    raise WorkflowError("Node.js 20+ is required; set TRIPO_NODE or install Node.js")


def tripo_command() -> list[str]:
    configured = os.environ.get("TRIPO_CLI")
    if configured:
        path = Path(configured).expanduser()
        if not path.is_file():
            raise WorkflowError(f"TRIPO_CLI does not name a file: {path}")
        return [str(path)]
    system = shutil.which("tripo")
    if system:
        return [system]
    if not LOCAL_TRIPO_JS.is_file():
        raise WorkflowError(
            "local Tripo CLI is missing; install tools/tripo-character/package.json first"
        )
    return [str(find_node()), str(LOCAL_TRIPO_JS)]


def parse_json_stdout(stdout: str, label: str) -> dict[str, Any]:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        raise WorkflowError(f"{label} produced no JSON on stdout")
    try:
        value = json.loads(lines[-1])
    except json.JSONDecodeError as exc:
        raise WorkflowError(f"{label} final stdout line was not JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise WorkflowError(f"{label} JSON root must be an object")
    return value


def run_tripo(
    args: list[str],
    *,
    label: str,
    stdin_payload: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    command = [*tripo_command(), *args]
    completed = subprocess.run(
        command,
        input=(json.dumps(stdin_payload) + "\n") if stdin_payload is not None else None,
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        meanings = {
            2: "invalid usage or parameters",
            3: "authentication failed; run the login command printed in the README",
            4: "insufficient Tripo credits; the human must run `tripo topup`",
            5: "content-policy rejection",
            6: "Tripo task failed; frozen credits should be refunded",
            7: "network error",
            8: "task or file not found",
            9: "rate limited; retry with backoff",
        }
        meaning = meanings.get(completed.returncode, "unexpected Tripo CLI failure")
        raise WorkflowError(f"{label} failed ({completed.returncode}: {meaning})")
    result = parse_json_stdout(completed.stdout, label)
    status = result.get("status")
    if isinstance(status, str) and status in TERMINAL_STATUSES and status != "success":
        raise WorkflowError(f"{label} ended with status {status}")
    return result


def files_in_result(result: Any) -> list[Path]:
    candidates: list[Path] = []

    def collect(value: Any) -> None:
        if not isinstance(value, dict):
            return
        output_dir = value.get("output_dir")
        base = Path(output_dir).expanduser() if isinstance(output_dir, str) else HERE
        if not base.is_absolute():
            base = (HERE / base).resolve()
        for key in ("model_file", "preview"):
            raw = value.get(key)
            if isinstance(raw, str):
                path = Path(raw).expanduser()
                candidates.append(path if path.is_absolute() else base / path)
        raw_files = value.get("files")
        if isinstance(raw_files, list):
            for raw in raw_files:
                if isinstance(raw, str):
                    path = Path(raw).expanduser()
                    candidates.append(path if path.is_absolute() else base / path)
        for key in ("chain", "outputs", "results"):
            children = value.get(key)
            for child in children if isinstance(children, list) else [children]:
                collect(child)

    collect(result)
    resolved: list[Path] = []
    seen: set[Path] = set()
    for path in candidates:
        path = path.resolve()
        if path.is_file() and path not in seen:
            seen.add(path)
            resolved.append(path)
    return resolved


def file_manifest(results: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    seen: set[Path] = set()
    for result in results:
        for path in files_in_result(result):
            if path in seen:
                continue
            seen.add(path)
            files.append(
                {
                    "path": str(path),
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
            )
    return files


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def cli_version() -> str:
    completed = subprocess.run(
        [*tripo_command(), "--version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    return completed.stdout.strip() if completed.returncode == 0 else "unknown"


def plan(args: argparse.Namespace, image: str, output: Path) -> dict[str, Any]:
    common = ["--json", "--yes", "--no-open", "--timeout", str(args.timeout)]
    make = [
        "make",
        image,
        "--out",
        str(output / "01-generate"),
        "--name",
        f"{args.name}-surface",
    ]
    if args.model != "auto":
        make.extend(["--model", args.model])
    for value in (
        f"face_limit={args.face_limit}",
        "texture=true",
        "pbr=true",
        "export_uv=true",
    ):
        make.extend(["--param", value])
    check = ["anim", "check", "--out", str(output / "02-rig-check")]
    rig = [
        "anim",
        "rig",
        "--rig-type",
        "biped",
        "--spec",
        "mixamo",
        "--out-format",
        "glb",
        "--param",
        f"model={args.rig_model}",
        "--out",
        str(output / "03-rig"),
    ]
    retarget = [
        "anim",
        "retarget",
        "--animation",
        *args.animations,
        "--out-format",
        "glb",
        "--animate-in-place",
        "--out",
        str(output / "04-animation"),
    ]
    return {
        "schemaVersion": 1,
        "kind": "img2threejs-tripo-character-workflow",
        "cliVersion": cli_version(),
        "input": image,
        "model": args.model,
        "faceLimit": args.face_limit,
        "rigModel": args.rig_model,
        "rigSpec": "mixamo",
        "animations": list(args.animations),
        "commands": {
            "generate": [*make, *common],
            "rigCheck": [*check, *common],
            "rig": [*rig, *common],
            "retarget": [*retarget, *common],
        },
        "boundary": (
            "Tripo outputs are external generative assets and motion evidence. "
            "They are not a code-only img2threejs factory or a complete CharacterIR."
        ),
    }


def local_image_record(image: str) -> dict[str, Any]:
    if image.startswith(("https://", "http://")):
        return {"kind": "url", "url": image}
    path = Path(image).expanduser().resolve()
    if not path.is_file():
        raise WorkflowError(f"input image does not exist: {path}")
    if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}:
        raise WorkflowError(f"unsupported image extension: {path.suffix}")
    if path.stat().st_size > 20 * 1024 * 1024:
        raise WorkflowError("Tripo image upload limit is 20 MB")
    return {
        "kind": "file",
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def run_probe(glb: Path, output: Path) -> None:
    probe = IMG2THREEJS_ROOT / "forge" / "stage1_intake" / "probe_glb.py"
    if not probe.is_file():
        raise WorkflowError(f"img2threejs probe is missing: {probe}")
    completed = subprocess.run(
        [sys.executable, str(probe), str(glb), "--out", str(output)],
        check=False,
    )
    if completed.returncode != 0:
        raise WorkflowError(f"img2threejs GLB probe failed for {glb}")


def run_character_seed(glb: Path, output: Path) -> None:
    adapter = HERE / "glb_rig_to_characterir.py"
    if not adapter.is_file():
        raise WorkflowError(f"CharacterIR seed adapter is missing: {adapter}")
    completed = subprocess.run(
        [sys.executable, str(adapter), str(glb), "--out-dir", str(output)],
        check=False,
    )
    if completed.returncode != 0:
        raise WorkflowError(f"rig payload extraction failed for {glb}")


def command_doctor(_: argparse.Namespace) -> int:
    completed = subprocess.run(
        [*tripo_command(), "doctor"],
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
        check=False,
    )
    try:
        tripo = parse_json_stdout(completed.stdout, "tripo doctor")
    except WorkflowError:
        tripo = {"ok": False, "raw": completed.stdout.strip()}

    pipeline_python = None
    python_candidates = [
        os.environ.get("IMG2THREEJS_PIPELINE_PYTHON"),
        str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"),
        shutil.which("python3.12"),
        sys.executable,
    ]
    seen: set[str] = set()
    for candidate in python_candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        check = subprocess.run(
            [candidate, "-c", "import sys,numpy,PIL; assert (3,11)<=sys.version_info[:2]<(3,13); print(sys.version.split()[0], numpy.__version__, PIL.__version__)"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
        )
        if check.returncode == 0:
            pipeline_python = {"path": candidate, "versions": check.stdout.strip()}
            break

    local = {
        "img2threejsSubmodule": (IMG2THREEJS_ROOT / "SKILL.md").is_file(),
        "showcaseSubmodule": (REPO_ROOT / "vendor/img2threejs-showcase/package.json").is_file(),
        "showcaseDependencies": (REPO_ROOT / "vendor/img2threejs-showcase/node_modules/three/package.json").is_file(),
        "glbPipelineNodeDependencies": (
            IMG2THREEJS_ROOT
            / "integrations/glb_character_pipeline/node/node_modules/playwright/package.json"
        ).is_file(),
        "tripoCli": LOCAL_TRIPO_JS.is_file(),
        "pipelinePython": pipeline_python,
    }
    ok = bool(tripo.get("ok")) and all(
        [
            local["img2threejsSubmodule"],
            local["showcaseSubmodule"],
            local["showcaseDependencies"],
            local["glbPipelineNodeDependencies"],
            local["tripoCli"],
            pipeline_python,
        ]
    )
    print(json.dumps({"ok": ok, "tripo": tripo, "local": local}, indent=2))
    return 0 if ok else 1


def command_login(args: argparse.Namespace) -> int:
    completed = subprocess.run(
        [*tripo_command(), "login", "--region", args.region],
        check=False,
    )
    return completed.returncode


def command_generate(args: argparse.Namespace) -> int:
    args.name = slug(args.name or Path(args.image).stem)
    args.animations = tuple(args.animations or DEFAULT_ANIMATIONS)
    if len(args.animations) > 5:
        raise WorkflowError("Tripo accepts at most five retarget animations per batch")
    image_record = local_image_record(args.image)
    image = image_record.get("path") or image_record.get("url")
    assert isinstance(image, str)
    output = Path(args.out).expanduser().resolve()
    workflow = plan(args, image, output)
    workflow["source"] = image_record
    workflow["status"] = "planned" if args.dry_run else "running"
    manifest_path = output / "workflow-manifest.json"
    write_json(manifest_path, workflow)

    if args.dry_run:
        print(json.dumps(workflow, indent=2, ensure_ascii=False))
        return 0

    stages: dict[str, dict[str, Any]] = {}
    try:
        stages["generate"] = run_tripo(
            workflow["commands"]["generate"], label="image-to-model"
        )
        workflow["stages"] = stages
        write_json(manifest_path, workflow)

        stages["rigCheck"] = run_tripo(
            workflow["commands"]["rigCheck"],
            label="rig-check",
            stdin_payload=stages["generate"],
        )
        riggable = stages["rigCheck"].get("riggable")
        if riggable is False:
            raise WorkflowError("Tripo reports this model is not riggable")
        workflow["stages"] = stages
        write_json(manifest_path, workflow)

        stages["rig"] = run_tripo(
            workflow["commands"]["rig"],
            label="auto-rig",
            stdin_payload=stages["rigCheck"],
        )
        workflow["stages"] = stages
        write_json(manifest_path, workflow)

        if args.animations:
            stages["retarget"] = run_tripo(
                workflow["commands"]["retarget"],
                label="animation-retarget",
                stdin_payload=stages["rig"],
            )

        workflow["stages"] = stages
        workflow["files"] = file_manifest(stages.values())

        generated_glbs = [
            path for path in files_in_result(stages["generate"]) if path.suffix.lower() == ".glb"
        ]
        if generated_glbs:
            run_probe(generated_glbs[0], output / "img2threejs" / "surface-glb-probe.json")

        rig_source = stages.get("retarget", stages["rig"])
        rigged_glbs = [
            path for path in files_in_result(rig_source) if path.suffix.lower() == ".glb"
        ]
        if not rigged_glbs:
            rigged_glbs = [
                path for path in files_in_result(stages["rig"]) if path.suffix.lower() == ".glb"
            ]
        if not rigged_glbs:
            raise WorkflowError("Tripo completed but no local rigged GLB was found")

        run_probe(rigged_glbs[0], output / "img2threejs" / "rigged-glb-probe.json")
        run_character_seed(rigged_glbs[0], output / "img2threejs" / "characterir-seed")
        workflow["status"] = "success"
        workflow["rigEvidenceSource"] = str(rigged_glbs[0])
        workflow["files"] = file_manifest(stages.values())
        write_json(manifest_path, workflow)
        print(json.dumps({"status": "success", "manifest": str(manifest_path)}, indent=2))
        return 0
    except Exception as exc:
        workflow["status"] = "failed"
        workflow["error"] = str(exc)
        workflow["stages"] = stages
        workflow["files"] = file_manifest(stages.values())
        write_json(manifest_path, workflow)
        raise


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    doctor = sub.add_parser("doctor", help="run the official Tripo environment/auth checks")
    doctor.set_defaults(func=command_doctor)
    login = sub.add_parser("login", help="start Tripo's browser device-login flow")
    login.add_argument("--region", choices=("ov", "cn"), default="ov")
    login.set_defaults(func=command_login)

    generate = sub.add_parser(
        "generate",
        help="generate, rig, retarget and prepare img2threejs rig evidence",
    )
    generate.add_argument("--image", required=True, help="local image path or public image URL")
    generate.add_argument("--name", help="stable character slug")
    generate.add_argument(
        "--out",
        default=str(HERE / "work"),
        help="workflow output directory (gitignored)",
    )
    generate.add_argument(
        "--model",
        choices=("auto", "tripo-p1", "tripo-v3.1"),
        default="tripo-p1",
    )
    generate.add_argument("--face-limit", type=int, default=5000)
    generate.add_argument(
        "--rig-model",
        default="v1.0-20240301",
        help="v1 biped has the 90+ preset library used for Warrior-like actions",
    )
    generate.add_argument(
        "--animation",
        dest="animations",
        action="append",
        help="repeat up to five times; defaults to idle, walk and victory",
    )
    generate.add_argument("--timeout", type=int, default=1800)
    generate.add_argument("--dry-run", action="store_true")
    generate.set_defaults(func=command_generate)
    return root


def main(argv: list[str]) -> int:
    args = parser().parse_args(argv)
    if (
        getattr(args, "command", "") == "generate"
        and getattr(args, "model", "") == "tripo-p1"
        and not 50 <= getattr(args, "face_limit", 5000) <= 20000
    ):
        raise WorkflowError("P1 face limit must be between 50 and 20,000")
    return int(args.func(args))


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except WorkflowError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2)
