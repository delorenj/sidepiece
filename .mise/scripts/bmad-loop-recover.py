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
- Ensures all story artifacts (spec, sprint-status.yaml, operator records) are synced.
- Cleans up stale multiplexer sessions (bmad-loop cleanup).
- Archives the stuck run (bmad-loop archive <run_id>).
- Ensures git worktree is clean before validation.
- Validates preflight (bmad-loop validate).
- Restarts the loop in detached mode (bmad-loop run).
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


def parse_spec_info(spec_path: Path) -> tuple[str | None, list[str]]:
    """Extract status and operator_actions from spec frontmatter."""
    if not spec_path.is_file():
        return None, []
    content = spec_path.read_text(encoding="utf-8", errors="replace")
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        return None, []
    fm_text = fm_match.group(1)
    status = None
    actions = []
    if yaml is not None:
        try:
            data = yaml.safe_load(fm_text)
            if isinstance(data, dict):
                status = str(data.get("status", "")).strip() or None
                raw_actions = data.get("operator_actions", [])
                if isinstance(raw_actions, list):
                    actions = [str(a) for a in raw_actions]
        except Exception:
            pass
    if status is None:
        m = re.search(r"^status:\s*['\"]?([a-zA-Z0-9_-]+)['\"]?", fm_text, re.MULTILINE)
        status = m.group(1) if m else None
    return status, actions


def set_spec_status(spec_path: Path, new_status: str, operator_actions: list[str] | None = None) -> bool:
    """Update frontmatter status (and optionally operator_actions) in spec."""
    if not spec_path.is_file():
        return False
    content = spec_path.read_text(encoding="utf-8")
    fm_match = re.match(r"^---\s*\n(.*?)\n---(.*)$", content, re.DOTALL)
    if not fm_match:
        return False
    fm_text = fm_match.group(1)
    rest = fm_match.group(2)

    # Replace status line
    pattern = r"^(status:\s*['\"]?)[a-zA-Z0-9_-]+(['\"]?)"
    if re.search(pattern, fm_text, re.MULTILINE):
        fm_text = re.sub(pattern, rf"\g<1>{new_status}\g<2>", fm_text, flags=re.MULTILINE)
    else:
        fm_text += f"\nstatus: '{new_status}'"

    # Add operator_actions if provided and not present
    if operator_actions and "operator_actions:" not in fm_text:
        fm_text += "\noperator_actions:\n"
        for act in operator_actions:
            fm_text += f'  - "{act}"\n'

    new_content = f"---\n{fm_text.strip()}\n---{rest}"
    spec_path.write_text(new_content, encoding="utf-8")
    return True


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


def ensure_operator_record(
    project_root: Path,
    story_key: str,
    spec_path: Path,
    actions: list[str],
    run_id: str = "",
) -> Path:
    """Ensure .bmad-loop/operator/<story_key>.json exists so validate does not warn."""
    op_dir = project_root / ".bmad-loop" / "operator"
    op_dir.mkdir(parents=True, exist_ok=True)
    rec_path = op_dir / f"{story_key}.json"
    if not rec_path.is_file() and actions:
        payload = {
            "actions": actions,
            "parked_at": "2026-09-24",
            "run_id": run_id,
            "spec_file": str(spec_path.relative_to(project_root)),
            "story_key": story_key,
        }
        rec_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return rec_path


def start_loop_detached(project_root: Path) -> str | None:
    """Launch bmad-loop detached using uv tool python or system python."""
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


def commit_and_push_artifacts(project: Path, msg: str, paths_to_stage: list[Path]) -> None:
    """Stage modified paths, commit, and push."""
    for p in paths_to_stage:
        if p.exists():
            run_cmd(["git", "add", str(p.relative_to(project))], cwd=project)
    # Check if anything is staged
    staged = run_cmd(["git", "diff", "--cached", "--name-only"], cwd=project).stdout.strip()
    if staged:
        run_cmd(["git", "commit", "-m", msg], cwd=project)
        print(f"   Committed: {msg}")
        print("   Pushing to origin main...")
        run_cmd(["git", "push", "origin", "main"], cwd=project)


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
        help="Proceed with recovery even if story status is in-review or ambiguous",
    )
    args = parser.parse_args()

    project = get_git_root(args.project)
    print(f"==> Inspecting bmad-loop state for {project}...")

    artifacts_dir = project / "_bmad-output" / "implementation-artifacts"
    sprint_status_file = artifacts_dir / "sprint-status.yaml"
    runs_dir = project / ".bmad-loop" / "runs"

    # Find paused runs
    paused_runs = []
    if runs_dir.is_dir():
        run_dirs = [d for d in runs_dir.iterdir() if d.is_dir()]
        run_dirs.sort(key=lambda d: d.name, reverse=True)
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

    # Case A: A run is currently paused
    if paused_runs:
        run_dir, state = paused_runs[0]
        run_id = state.get("run_id", run_dir.name)
        story_key = state.get("paused_story_key", "")
        paused_reason = state.get("paused_reason", "")
        paused_stage = state.get("paused_stage", "")

        print(f"Found paused run: {run_id}")
        print(f"  Stage: {paused_stage}")
        print(f"  Story: {story_key}")
        first_line = paused_reason.splitlines()[0] if paused_reason else "none"
        print(f"  Reason: {first_line}")

        spec_path = artifacts_dir / f"spec-{story_key}.md" if story_key else None
        spec_status, operator_actions = parse_spec_info(spec_path) if spec_path else (None, [])
        print(f"  Spec file: {spec_path.name if spec_path and spec_path.is_file() else 'missing'}")
        print(f"  Spec status: {spec_status or 'unknown'}")

        sprint_data = load_sprint_status(sprint_status_file)
        dev_status = sprint_data.get("development_status", {})
        sprint_story_status = dev_status.get(story_key)
        print(f"  Sprint-status value: {sprint_story_status or 'none'}")

        # Check git commit history to see if the story was committed
        head_msg = run_cmd(["git", "log", "-1", "--format=%s"], cwd=project).stdout.strip()
        story_in_recent_commits = any(
            story_key in c or f"story {story_key.split('-')[0]}-{story_key.split('-')[1]}" in c
            for c in run_cmd(["git", "log", "-5", "--format=%s"], cwd=project).stdout.splitlines()
        )

        completed_statuses = {"done", "awaiting-operator"}
        is_completed = spec_status in completed_statuses or sprint_story_status in completed_statuses

        if not is_completed and (story_in_recent_commits or args.force):
            # Story was committed or user forced recovery
            target_status = "awaiting-operator" if (operator_actions or "awaiting-operator" in head_msg) else "done"
            print(f"  Resolving story status -> {target_status}")
            if not args.dry_run and spec_path:
                set_spec_status(spec_path, target_status, operator_actions)
                spec_status = target_status
                is_completed = True

        if not is_completed and not args.force:
            print("\n[!] The story is not marked done/awaiting-operator and has no matching commit.")
            print("    Use --force to override and finalize.")
            return 1

        print("\n==> Reconciling artifacts and clearing paused run:")
        paths_to_stage: list[Path] = []

        if spec_path and spec_path.is_file():
            paths_to_stage.append(spec_path)

        if spec_status in completed_statuses:
            if sprint_story_status != spec_status:
                print(f"1. Updating sprint-status.yaml for {story_key} -> {spec_status}...")
                if not args.dry_run:
                    update_sprint_status_key(sprint_status_file, story_key, spec_status)
            paths_to_stage.append(sprint_status_file)

            if spec_status == "awaiting-operator":
                op_rec = ensure_operator_record(project, story_key, spec_path, operator_actions, run_id)
                paths_to_stage.append(op_rec)

        # Stage and commit all artifact updates
        if not args.dry_run and paths_to_stage:
            commit_and_push_artifacts(
                project,
                f"chore(bmad): sync status and artifacts for story {story_key} ({spec_status})",
                paths_to_stage,
            )

        # Clean dead sessions
        print("2. Cleaning up dead/stale multiplexer sessions...")
        if not args.dry_run:
            clean_res = run_cmd(["bmad-loop", "cleanup"], cwd=project, check=False)
            print(f"   {clean_res.stdout.strip()}")
        else:
            print("[dry-run] Would run `bmad-loop cleanup`.")

        # Archive paused run
        print(f"3. Archiving paused run {run_id} to .bmad-loop/archive/...")
        if not args.dry_run:
            arch_res = run_cmd(["bmad-loop", "archive", run_id, "--force"], cwd=project, check=False)
            print(f"   {arch_res.stdout.strip() or arch_res.stderr.strip()}")
        else:
            print(f"[dry-run] Would run `bmad-loop archive {run_id} --force`.")

    # Case B: No active paused run (e.g. was already archived, or recovering dirty working tree)
    else:
        print("No paused runs found.")

        # Check if working tree has unstaged artifacts that should be reconciled
        git_status = run_cmd(["git", "status", "--porcelain"], cwd=project).stdout.splitlines()
        dirty_artifacts = [
            project / line[3:].strip()
            for line in git_status
            if "_bmad-output" in line or ".bmad-loop/operator" in line
        ]
        if dirty_artifacts:
            print(f"Found {len(dirty_artifacts)} uncommitted artifact file(s):")
            for p in dirty_artifacts:
                print(f"  - {p.relative_to(project)}")
            if not args.dry_run:
                print("==> Staging and committing artifact changes...")
                commit_and_push_artifacts(
                    project,
                    "chore(bmad): reconcile story artifacts and operator records",
                    dirty_artifacts,
                )
            else:
                print("[dry-run] Would stage, commit, and push dirty artifact files.")

    # Check for any remaining dirty files in git worktree before validate
    remaining_status = run_cmd(["git", "status", "--porcelain"], cwd=project).stdout.strip()
    if remaining_status:
        print("\n[!] Git worktree still has uncommitted changes outside managed artifacts:")
        for line in remaining_status.splitlines():
            print(f"    {line}")
        print("    Commit, stash, or remove these files before bmad-loop can validate.")
        return 1

    # Validate preflight
    print("\n==> Validating preflight requirements...")
    if not args.dry_run:
        val_res = run_cmd(["bmad-loop", "validate"], cwd=project, check=False)
        if val_res.returncode != 0:
            print("   [!] Validation failed:\n" + val_res.stdout + val_res.stderr)
            return 1
        print("   Preflight validation passed.")
    else:
        print("[dry-run] Would run `bmad-loop validate`.")

    # Restart loop
    if not args.no_restart:
        print("\n==> Starting fresh loop run in detached mode...")
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
        print("\n==> Skipping restart (--no-restart passed).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
