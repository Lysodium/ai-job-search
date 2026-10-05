"""Keep the Cowork plugin wired to the canonical .claude/ workflows."""

import importlib.util
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_cowork_plugin", ROOT / "tools" / "build_cowork_plugin.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

# Commands reached through another plugin skill rather than one of their own.
COVERED_ELSEWHERE = {"html-report"}  # served by the `dashboard` skill


def test_every_command_has_a_cowork_skill():
    skill_names = {name for name, _, _ in build.SKILLS}
    commands = {p.stem for p in (ROOT / ".claude" / "commands").glob("*.md")}
    missing = commands - skill_names - COVERED_ELSEWHERE
    assert not missing, f"add these commands to SKILLS in tools/build_cowork_plugin.py: {sorted(missing)}"


def test_skill_targets_exist():
    for name, target, _ in build.SKILLS:
        assert (ROOT / target).is_file(), f"{name}: {target} does not exist"
    assert (ROOT / "cowork" / "RUNTIME.md").is_file()


def test_template_excludes_personal_data():
    for path in ["job_search_tracker.csv", "dashboard-data.js", "cv/acme/main_acme_x.tex",
                 "cover_letters/acme/cover_acme_x.tex", "company_research/acme.json",
                 "documents/cv/my_cv.pdf", "documents/applications/acme/outcome.md",
                 ".mcp.json", "SETUP-ME.md", ".pi/credentials/client.json"]:
        assert not build.keep(path), path
    for path in ["cv/main_example.tex", "cover_letters/cover.cls", "documents/README.md"]:
        assert build.keep(path), path


def test_built_plugin_matches_skill_list():
    plugin = ROOT / "cowork" / "ai-job-search.plugin"
    assert plugin.is_file(), "run: python3 tools/build_cowork_plugin.py"
    with zipfile.ZipFile(plugin) as zf:
        names = set(zf.namelist())
    assert ".claude-plugin/plugin.json" in names
    for name, _, _ in build.SKILLS:
        assert f"skills/{name}/SKILL.md" in names, f"rebuild the plugin: {name} missing"
    assert "skills/setup/assets/workspace-template.zip" in names
