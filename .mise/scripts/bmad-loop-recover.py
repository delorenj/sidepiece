#!/usr/bin/env python3
"""bmad-loop-recover.py

Diagnose and safely recover from bmad-loop baseline divergence,
stalled manual-rollback pauses, or out-of-band completed stories.

Typical failure scenario:
1. An agent commits and pushes or git pull --rebase happens during a story.
2. The commit SHA recorded as task.baseline_commit is rebased away.
3. bmad-loop verification rejects the new baseline and pauses with:
   'spec baseline X does not match orchestrator-recorded baseline Y'
   'ACTION REQUIRED — manual recovery needed (committed work present)'
4. Outside the loop, the story is actually finished (reviewed and committed).
5. Attempting to resume fails because the old run is anchored to the stale SHA.

This script:
- Diagnoses the paused run and story state.
- If the story is already completed (spec status is done/awaiting-operator):
  - Stages and commits any pending sprint-status.yaml update.
  - Cleans up stale multiplexer sessions (bmad-loop cleanup).
  - Archives the stuck run (bmad-loop archive <run_id>).
  - Validates preflight (bmad-loop validate).
  - Restarts the loop in detached mode (bmad-loop run).
- If the story is incomplete, offers rescue branch creation and rollback options.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

try:
    import yaml
except ImportError:
    yaml = None  # fallback to regex parsing if needed


def run_cmd(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return CompletedProcess."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        text=True,
        capture_output=capture,
    )


def get_git_root(cwd: Path) -> Path:
    res = run_cmd(["git", "rev-parse", "--show-toplevel"], cwd=cwd)
    return Path(res.stdout.strip())


def parse_spec_status(spec_path: Path) -> str | None:
    if not spec_path.is_file():
        return None
    content = spec_path.read_text(encoding="utf-8", errors="replace")
    # Parse YAML frontmatter
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        return None
    fm_text = fm_match.group(1)
    if yaml is not None:
        try:
            data = yaml.safe_load(fm_text)
            if isinstance(data, dict):
                return str(data.get("status", "")).strip()
        except Exception:
            pass
    # Regex fallback
    m = re.search(r"^status:\s*['\"]?([a-zA-Z0-9_-]+)['\"]?", fm_text, re.MULTILINE)
    return m.group(1) if m else None


def load_sprint_status(status_file: Path) -> dict:
    if not status_file.is_file():
        return {}
    content = status_file.read_text(encoding="utf-8", errors="replace")
    if yaml is not None:
        try:
            data = yaml.safe_load(content)
            return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}


def update_sprint_status_key(status_file: Path, story_key: str, new_status: str) -> bool:
    if not status_file.is_file():
        return False
    content = status_file.read_text(encoding="utf-8")
    pattern = rf"^(\s*{re.escape(story_key)}:\s*)([a-zA-Z0-9_-]+)"
    match = re.search(pattern, content, re.MULTILINE)
    if match:
        old_val = match.group(2)
        if old_val == new_status:
            return False
        replaced = re.sub(pattern, rf"\g<1>{new_status}", content, count=1, flags=re.MULTILINE)
        status_file.write_text(replaced, encoding="utf-8")
        return True
    return False


def start_loop_detached(project_root: Path) -> str | None:
    """Launch bmad-loop detached using the uv tool python or system python."""
    # Find bmad_loop python
    uv_python = Path(os.path.expanduser("~/.local/share/uv/tools/bmad-loop/bin/python"))
    python_bin = uv_python if uv_python.is_file() else Path(sys.executable)

    script = (
        "from pathlib import Path\n"
        "from bmad_loop import runs\n"
        "from bmad_loop.tui import launch\n"
        f"project = Path('{project_root.resolve()}')\n"
        "run_id = runs.new_run_id()\n"
        "launch.start_run_detached(project, run_id)\n"
        "print(run_id)\n"
    )
    res = subprocess.run(
        [str(python_bin), "-c", script],
        cwd=project_root,
        capture_output=True,
        text=True,
    )
    if res.returncode == 0:
        return res.stdout.strip()
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Diagnose and recover from bmad-loop paused/diverged state and restart the loop."
    )
    parser.add_argument(
        "--project",
        type=Path,
        default=Path.cwd(),
        help="Target project root (default: current working directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Diagnose and print actions without making changes",
    )
    parser.add_argument(
        "--no-restart",
        action="store_true",
        help="Do not start a fresh bmad-loop run after recovery",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Proceed with recovery even if story status is ambiguous",
    )
    args = parser.parse_args()

    project = get_git_root(args.project)
    print(f"==> Inspecting bmad-loop state for {project}...")

    runs_dir = project / ".bmad-loop" / "runs"
    if not runs_dir.is_dir():
        print("No .bmad-loop/runs directory found.")
        return 0

    # Scan for runs
    run_dirs = [d for d in runs_dir.iterdir() if d.is_dir()]
    if not run_dirs:
        print("No active or paused bmad-loop runs found.")
        if not args.no_restart:
            print("==> Checking if loop can be started...")
            val = run_cmd(["bmad-loop", "validate"], cwd=project, check=False)
            if val.returncode == 0:
                print("==> Starting fresh loop run...")
                if not args.dry_run:
                    new_run = start_loop_detached(project)
                    print(f"==> Started bmad-loop run: {new_run}")
                else:
                    print("[dry-run] Would launch fresh detached loop run.")
            else:
                print("bmad-loop validate failed:\n" + val.stdout + val.stderr)
        return 0

    # Sort newest first
    run_dirs.sort(key=lambda d: d.name, reverse=True)
    paused_runs = []
    for d in run_dirs:
        state_file = d / "state.json"
        if not state_file.is_file():
            continue
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
            if state.get("paused_stage") or "ACTION REQUIRED" in state.get("paused_reason", ""):
                paused_runs.append((d, state))
        except Exception:
            continue

    if not paused_runs:
        print("Found active run(s), but none are paused in escalation/recovery.")
        run_cmd(["bmad-loop", "status"], cwd=project, check=False, capture=False)
        return 0

    run_dir, state = paused_runs[0]
    run_id = state.get("run_id", run_dir.name)
    story_key = state.get("paused_story_key")
    paused_reason = state.get("paused_reason", "")
    paused_stage = state.get("paused_stage", "")

    print(f"Found paused run: {run_id}")
    print(f"  Stage: {paused_stage}")
    print(f"  Story: {story_key}")
    first_line = paused_reason.splitlines()[0] if paused_reason else "none"
    print(f"  Reason: {first_line}")

    # Check story artifacts
    artifacts_dir = project / "_bmad-output" / "implementation-artifacts"
    spec_path = artifacts_dir / f"spec-{story_key}.md" if story_key else None
    sprint_status_file = artifacts_dir / "sprint-status.yaml"

    spec_status = parse_spec_status(spec_path) if spec_path else None
    print(f"  Spec file: {spec_path.name if spec_path and spec_path.is_file() else 'missing'}")
    print(f"  Spec status: {spec_status or 'unknown'}")

    # Check sprint-status.yaml
    sprint_data = load_sprint_status(sprint_status_file)
    dev_status = sprint_data.get("development_status", {})
    sprint_story_status = dev_status.get(story_key) if story_key else None
    print(f"  Sprint-status value: {sprint_story_status or 'none'}")

    # Check git working tree
    git_diff = run_cmd(["git", "diff", "--name-only"], cwd=project).stdout.splitlines()
    git_status = run_cmd(["git", "status", "--porcelain"], cwd=project).stdout.splitlines()

    sprint_modified_unstaged = any("sprint-status.yaml" in line for line in git_diff)

    # Determine if story work was completed
    completed_statuses = {"done", "awaiting-operator"}
    is_completed = (
        spec_status in completed_statuses
        or sprint_story_status in completed_statuses
        or (sprint_modified_unstaged and spec_status in completed_statuses)
    )

    if not is_completed and not args.force:
        print("\n[!] The story does not appear to be marked done or awaiting-operator.")
        print("    If the story truly failed, you may need a manual rollback:")
        print(f"    git reset --hard <baseline> && bmad-loop resume {run_id}")
        print("    Use --force to override if this story was verified outside bmad-loop.")
        return 1

    print("\n==> Story work is finished/verified. Proceeding with safe recovery:")

    # 1. Sync & commit sprint-status.yaml if needed
    if spec_status in completed_statuses and sprint_story_status != spec_status:
        print(f"1. Syncing sprint-status.yaml for {story_key} -> {spec_status}...")
        if not args.dry_run:
            update_sprint_status_key(sprint_status_file, story_key, spec_status)
            run_cmd(
                ["git", "add", str(sprint_status_file.relative_to(project))],
                cwd=project,
            )
            commit_msg = f"chore(sprint): sync sprint status for story {story_key} ({spec_status})"
            run_cmd(["git", "commit", "-m", commit_msg], cwd=project)
            print(f"   Committed sprint status sync: {commit_msg}")
            print("   Pushing to origin main...")
            run_cmd(["git", "push", "origin", "main"], cwd=project)
        else:
            print(f"[dry-run] Would sync sprint-status.yaml for {story_key} to {spec_status}, commit, and push.")

    elif sprint_modified_unstaged:
        print("1. Committing unstaged sprint-status.yaml update...")
        if not args.dry_run:
            run_cmd(
                ["git", "add", str(sprint_status_file.relative_to(project))],
                cwd=project,
            )
            commit_msg = f"chore(sprint): update sprint status for {story_key}"
            run_cmd(["git", "commit", "-m", commit_msg], cwd=project)
            print("   Pushing to origin main...")
            run_cmd(["git", "push", "origin", "main"], cwd=project)
        else:
            print("[dry-run] Would commit and push unstaged sprint-status.yaml.")

    # 2. Cleanup multiplexer sessions
    print("2. Cleaning up dead/stale multiplexer sessions...")
    if not args.dry_run:
        clean_res = run_cmd(["bmad-loop", "cleanup"], cwd=project, check=False)
        print(f"   {clean_res.stdout.strip()}")
    else:
        print("[dry-run] Would run `bmad-loop cleanup`.")

    # 3. Archive paused run
    print(f"3. Archiving paused run {run_id} to .bmad-loop/archive/...")
    if not args.dry_run:
        arch_res = run_cmd(
            ["bmad-loop", "archive", run_id, "--force"],
            cwd=project,
            check=False,
        )
        if arch_res.returncode == 0:
            print(f"   {arch_res.stdout.strip()}")
        else:
            print(f"   Archive notice: {arch_res.stderr.strip() or arch_res.stdout.strip()}")
    else:
        print(f"[dry-run] Would run `bmad-loop archive {run_id} --force`.")

    # 4. Preflight validate
    print("4. Validating preflight requirements...")
    if not args.dry_run:
        val_res = run_cmd(["bmad-loop", "validate"], cwd=project, check=False)
        if val_res.returncode != 0:
            print("   [!] Validation failed:\n" + val_res.stdout + val_res.stderr)
            return 1
        print("   Preflight validation passed.")
    else:
        print("[dry-run] Would run `bmad-loop validate`.")

    # 5. Restart loop
    if not args.no_restart:
        print("5. Starting fresh loop run in detached mode...")
        if not args.dry_run:
            new_run_id = start_loop_detached(project)
            if new_run_id:
                print(f"==> SUCCESS: bmad-loop restarted with run ID: {new_run_id}")
                print("    Inspect progress with: bmad-loop status")
                print("    Open dashboard with:   bmad-loop tui")
            else:
                print("   [!] Could not start detached run automatically. Run `bmad-loop run` to start.")
        else:
            print("[dry-run] Would launch new detached loop run.")
    else:
        print("5. Skipping restart (--no-restart passed).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
