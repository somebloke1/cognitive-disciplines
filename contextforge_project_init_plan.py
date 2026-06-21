#!/usr/bin/env python3
"""Generate a ContextForge project-init plan for this project.

This intentionally proposes a plan only. It does not approve or apply the plan,
and it does not write project-local Codex config or project state.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


DEFAULT_PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_CF_CONTROLPLANE = Path("/home/dgk/workspace/cf-controlplane")
DEFAULT_SERVICES = [
    "context7:canonical",
    "github:canonical",
    "mentality:static_repo_local",
    "web-search:credential_scoped",
]
SELECTION_NUMBERS = {
    "1": "context7:canonical",
    "2": "exa-search:credential_scoped",
    "3": "github:canonical",
    "4": "mentality:static_repo_local",
    "5": "openzeppelin-solidity-contracts:canonical",
    "6": "playwright:session_scoped",
    "7": "serena:b27e6d9fde4b",
    "8": "ssh-tmux:session_scoped",
    "9": "web-search:credential_scoped",
}


def parse_services(values: list[str]) -> list[str]:
    if not values:
        return list(DEFAULT_SERVICES)

    services: list[str] = []
    for value in values:
        for part in value.split(","):
            item = part.strip()
            if not item:
                continue
            services.append(SELECTION_NUMBERS.get(item, item))
    return services


def import_contextforge_helper(controlplane_root: Path) -> Any:
    scripts_dir = controlplane_root / "scripts"
    if not scripts_dir.exists():
        raise FileNotFoundError(f"ContextForge scripts directory not found: {scripts_dir}")
    sys.path.insert(0, str(scripts_dir))
    import contextforge_helper_mcp  # type: ignore[import-not-found]

    return contextforge_helper_mcp


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate and print a ContextForge project-init installation plan."
    )
    parser.add_argument(
        "--project-root",
        default=str(DEFAULT_PROJECT_ROOT),
        help="Project root to initialize. Defaults to this script's directory.",
    )
    parser.add_argument(
        "--client-type",
        default="codex",
        help="Target client type. Defaults to codex.",
    )
    parser.add_argument(
        "--cf-controlplane",
        default=str(DEFAULT_CF_CONTROLPLANE),
        help="Path to the ContextForge control-plane checkout.",
    )
    parser.add_argument(
        "--service",
        action="append",
        default=[],
        help="Service binding or selection number. Can be repeated or comma-separated.",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Print the full raw helper result instead of the public plan summary.",
    )
    parser.add_argument(
        "--approve-and-apply",
        action="store_true",
        help="Approve and apply the cached plan. Requires prior user approval.",
    )
    args = parser.parse_args()

    project_root = str(Path(args.project_root).expanduser().resolve(strict=False))
    controlplane_root = Path(args.cf_controlplane).expanduser().resolve(strict=False)
    selected_services = parse_services(args.service)

    helper_mcp = import_contextforge_helper(controlplane_root)
    if args.approve_and_apply:
        approval = helper_mcp.cf_project_init_approve(project_root=project_root)
        if approval.get("ok") is False:
            print(json.dumps(approval, indent=2, sort_keys=True))
            return 1

        result = helper_mcp.cf_project_init_apply(project_root=project_root, dry_run=False)
        public = helper_mcp.client_visible_project_init_apply_payload(result)
        print(json.dumps(public, indent=2, sort_keys=True))
        return 0 if public.get("ok") is not False else 1

    result = helper_mcp.cf_project_init_propose(
        project_root=project_root,
        selected_services=selected_services,
        client_type=args.client_type,
    )

    if args.raw:
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result.get("ok") is not False else 1

    public = helper_mcp.client_visible_project_init_plan_payload(
        result,
        include_next_turn=False,
    )
    print(json.dumps(public, indent=2, sort_keys=True))
    return 0 if public.get("ok") is not False else 1


if __name__ == "__main__":
    raise SystemExit(main())
