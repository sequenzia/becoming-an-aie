"""The model step's prompt and its run file. No model call."""

from pathlib import Path

import pytest

import fresh
from adapter import TaskFailure, TaskResult
from records import Scenario, load_policy, load_scenarios

SCENARIOS = load_scenarios()


def result(text: str) -> TaskResult:
    return TaskResult(
        text=text,
        input_tokens=300,
        output_tokens=250,
        latency_ms=1200,
        model="claude-opus-5",
        provider="anthropic",
    )


def test_the_system_prompt_numbers_every_rule() -> None:
    policy = load_policy()
    prompt = fresh.system_prompt(policy)
    assert prompt.startswith(policy.assistant)
    for number, rule in enumerate(policy.rules, 1):
        assert f"{number}. {rule}" in prompt
    assert prompt.endswith("Write only the reply to the customer, as plain text.")


def test_the_user_message_has_the_facts_then_the_customer() -> None:
    scenario = Scenario("F99", "When do we renew?", {"Renewal date": "2026-11-03"})
    assert fresh.user_message(scenario) == (
        "Facts you can see:\n- Renewal date: 2026-11-03\n\n"
        "Customer message:\nWhen do we renew?"
    )


def test_records_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "runs" / fresh.run_file_name("20261009T120000Z", "anthropic", "m")
    answered = fresh.from_result("F01", result("  A reply.  "), "t1")
    failed = fresh.from_failure(
        "F02", TaskFailure("server", "Overloaded.", retryable=True), "m", "openai", "t2"
    )
    fresh.append(path, answered)
    fresh.append(path, failed)
    records = fresh.read(path)
    assert records == [answered, failed]
    assert records[0].reply == "A reply."
    assert list(fresh.answered(records)) == ["F01"]


def test_outputs_are_the_answered_replies_in_scenario_order(tmp_path: Path) -> None:
    path = tmp_path / "run.jsonl"
    fresh.append(path, fresh.from_result("F03", result("third"), "t"))
    fresh.append(path, fresh.from_result("F01", result("first"), "t"))
    outputs = fresh.outputs(path, SCENARIOS)
    assert [(o.id, o.reply) for o in outputs] == [("F01", "first"), ("F03", "third")]
    assert outputs[0].facts == SCENARIOS[0].facts


def test_newest_picks_the_latest_run(tmp_path: Path) -> None:
    for stamp, provider in [
        ("20261009T100000Z", "anthropic"),
        ("20261009T110000Z", "openai"),
    ]:
        (tmp_path / fresh.run_file_name(stamp, provider, "m")).write_text("")
    assert fresh.newest(tmp_path) == tmp_path / "fresh-20261009T110000Z-openai-m.jsonl"
    by_provider = fresh.newest(tmp_path, "anthropic", "m")
    assert by_provider == tmp_path / "fresh-20261009T100000Z-anthropic-m.jsonl"
    assert fresh.newest(tmp_path, "anthropic", "other") is None


def test_model_ids_are_made_safe_for_file_names() -> None:
    assert fresh.run_file_name("s", "openai", "org/model:1") == (
        "fresh-s-openai-org_model_1.jsonl"
    )


def test_labels_for_a_run_live_in_the_work_folder(tmp_path: Path) -> None:
    run = tmp_path / "runs" / "fresh-s-anthropic-m.jsonl"
    assert fresh.labels_path(run, tmp_path / "work") == (
        tmp_path / "work" / "fresh-s-anthropic-m-labels.jsonl"
    )


def test_a_bad_run_line_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "run.jsonl"
    path.write_text('{"id": "F01", "status": "odd"}\n', encoding="utf-8")
    with pytest.raises(fresh.RunFileError, match="unknown status"):
        fresh.read(path)
    path.write_text('{"id": "F01", "status": "answered", "input_tokens": -1}\n')
    with pytest.raises(fresh.RunFileError, match="whole number"):
        fresh.read(path)
