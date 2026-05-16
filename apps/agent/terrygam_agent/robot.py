from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

RobotMode = Literal["mock", "simulation", "hardware"]
RobotActionName = Literal["status", "look_at", "react", "speak", "stop"]

DEFAULT_ROBOT_MODE: RobotMode = "mock"
DEFAULT_DAEMON_URL = "http://127.0.0.1:8000"

LOOK_AT_TARGETS = {
    "center": {"body_yaw": 0.0, "antennas": [-0.17, 0.17]},
    "current_speaker": {"body_yaw": 0.0, "antennas": [-0.32, 0.32]},
    "person_left": {"body_yaw": 0.35, "antennas": [-0.4, 0.18]},
    "person_right": {"body_yaw": -0.35, "antennas": [-0.18, 0.4]},
    "whiteboard": {"body_yaw": 0.0, "antennas": [-0.08, 0.08]},
}

REACTION_TARGETS = {
    "thoughtful_ack": {"body_yaw": 0.0, "antennas": [-0.45, 0.45]},
    "insight": {"body_yaw": 0.18, "antennas": [-0.55, 0.2]},
    "risk": {"body_yaw": -0.18, "antennas": [-0.2, 0.55]},
    "confused": {"body_yaw": -0.12, "antennas": [-0.58, 0.12]},
    "celebrate": {"body_yaw": 0.0, "antennas": [-0.8, 0.8]},
}


@dataclass(frozen=True)
class RobotActionResult:
    ok: bool
    mode: RobotMode
    action: RobotActionName
    message: str
    arguments: dict[str, Any] = field(default_factory=dict)
    response: dict[str, Any] | list[Any] | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_json(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "mode": self.mode,
            "action": self.action,
            "message": self.message,
            "arguments": self.arguments,
            "response": self.response,
            "timestamp": self.timestamp,
        }


class RobotAdapter:
    mode: RobotMode

    def status(self) -> RobotActionResult:
        raise NotImplementedError

    def look_at(self, target: str) -> RobotActionResult:
        raise NotImplementedError

    def react(self, emotion: str) -> RobotActionResult:
        raise NotImplementedError

    def speak(self, text: str) -> RobotActionResult:
        raise NotImplementedError

    def stop(self) -> RobotActionResult:
        raise NotImplementedError


class MockRobotAdapter(RobotAdapter):
    mode: RobotMode = "mock"

    def __init__(self) -> None:
        self.actions: list[RobotActionResult] = []

    def status(self) -> RobotActionResult:
        return self._record("status", {}, "Mock robot adapter ready.")

    def look_at(self, target: str) -> RobotActionResult:
        target_args = LOOK_AT_TARGETS.get(target, LOOK_AT_TARGETS["center"])
        return self._record(
            "look_at",
            {"target": target, **target_args},
            f"Mock look_at({target}) accepted.",
        )

    def react(self, emotion: str) -> RobotActionResult:
        target_args = REACTION_TARGETS.get(emotion, REACTION_TARGETS["thoughtful_ack"])
        return self._record(
            "react",
            {"emotion": emotion, **target_args},
            f"Mock react({emotion}) accepted.",
        )

    def speak(self, text: str) -> RobotActionResult:
        return self._record("speak", {"text": text}, "Mock speak accepted.")

    def stop(self) -> RobotActionResult:
        return self._record("stop", {}, "Mock robot stop accepted.")

    def _record(
        self,
        action: RobotActionName,
        arguments: dict[str, Any],
        message: str,
    ) -> RobotActionResult:
        result = RobotActionResult(
            ok=True,
            mode=self.mode,
            action=action,
            arguments=arguments,
            message=message,
        )
        self.actions.append(result)
        return result


class ReachyDaemonAdapter(RobotAdapter):
    def __init__(
        self,
        *,
        mode: Literal["simulation", "hardware"],
        daemon_url: str = DEFAULT_DAEMON_URL,
        allow_hardware_motion: bool = False,
    ) -> None:
        self.mode: RobotMode = mode
        self.daemon_url = daemon_url.rstrip("/")
        self.allow_hardware_motion = allow_hardware_motion

    def status(self) -> RobotActionResult:
        try:
            response = self._request_json(
                "GET",
                "/api/state/full?with_head_pose=false&with_body_yaw=true&with_antenna_positions=true",
            )
            return RobotActionResult(
                ok=True,
                mode=self.mode,
                action="status",
                message=f"Reachy daemon reachable at {self.daemon_url}.",
                response=response,
            )
        except Exception as error:
            return RobotActionResult(
                ok=False,
                mode=self.mode,
                action="status",
                message=f"Reachy daemon unavailable at {self.daemon_url}: {error}",
            )

    def look_at(self, target: str) -> RobotActionResult:
        target_args = LOOK_AT_TARGETS.get(target, LOOK_AT_TARGETS["center"])
        return self._goto(
            action="look_at",
            arguments={"target": target, **target_args},
            message=f"Reachy look_at({target}) requested.",
        )

    def react(self, emotion: str) -> RobotActionResult:
        target_args = REACTION_TARGETS.get(emotion, REACTION_TARGETS["thoughtful_ack"])
        return self._goto(
            action="react",
            arguments={"emotion": emotion, **target_args},
            message=f"Reachy react({emotion}) requested.",
        )

    def speak(self, text: str) -> RobotActionResult:
        return RobotActionResult(
            ok=False,
            mode=self.mode,
            action="speak",
            message="Robot speech is not wired yet; use dashboard text/audio for now.",
            arguments={"text": text},
        )

    def stop(self) -> RobotActionResult:
        if self._hardware_motion_blocked():
            return self._blocked("stop", {})
        try:
            running = self._request_json("GET", "/api/move/running")
            stopped: list[Any] = []
            for item in running if isinstance(running, list) else []:
                uuid = item.get("uuid") if isinstance(item, dict) else None
                if uuid:
                    stopped.append(
                        self._request_json("POST", "/api/move/stop", {"uuid": uuid})
                    )
            return RobotActionResult(
                ok=True,
                mode=self.mode,
                action="stop",
                message=f"Stopped {len(stopped)} running Reachy move(s).",
                response={"stopped": stopped},
            )
        except Exception as error:
            return RobotActionResult(
                ok=False,
                mode=self.mode,
                action="stop",
                message=f"Reachy stop failed: {error}",
            )

    def _goto(
        self,
        *,
        action: Literal["look_at", "react"],
        arguments: dict[str, Any],
        message: str,
    ) -> RobotActionResult:
        if self._hardware_motion_blocked():
            return self._blocked(action, arguments)
        try:
            payload = {
                "body_yaw": arguments["body_yaw"],
                "antennas": arguments["antennas"],
                "duration": 0.8,
                "interpolation": "minjerk",
            }
            response = self._request_json("POST", "/api/move/goto", payload)
            return RobotActionResult(
                ok=True,
                mode=self.mode,
                action=action,
                message=message,
                arguments=arguments,
                response=response,
            )
        except Exception as error:
            return RobotActionResult(
                ok=False,
                mode=self.mode,
                action=action,
                message=f"Reachy {action} failed: {error}",
                arguments=arguments,
            )

    def _hardware_motion_blocked(self) -> bool:
        return self.mode == "hardware" and not self.allow_hardware_motion

    def _blocked(self, action: RobotActionName, arguments: dict[str, Any]) -> RobotActionResult:
        return RobotActionResult(
            ok=False,
            mode=self.mode,
            action=action,
            message="Hardware motion blocked. Set TERRYGAM_ROBOT_ALLOW_MOTION=1 to enable real movement.",
            arguments=arguments,
        )

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        timeout: float = 2.0,
    ) -> dict[str, Any] | list[Any]:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.daemon_url}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {error.code}: {detail}") from error
        return json.loads(body or "{}")


def get_robot_adapter() -> RobotAdapter:
    mode = os.getenv("TERRYGAM_ROBOT_MODE", DEFAULT_ROBOT_MODE).strip().lower()
    if mode not in {"mock", "simulation", "hardware"}:
        mode = DEFAULT_ROBOT_MODE
    if mode == "mock":
        return MockRobotAdapter()
    return ReachyDaemonAdapter(
        mode=mode,  # type: ignore[arg-type]
        daemon_url=os.getenv("TERRYGAM_REACHY_DAEMON_URL", DEFAULT_DAEMON_URL),
        allow_hardware_motion=os.getenv("TERRYGAM_ROBOT_ALLOW_MOTION") == "1",
    )


def dispatch_robot_tool_intent(intent: dict[str, Any]) -> RobotActionResult | None:
    name = intent.get("name")
    arguments = intent.get("arguments") if isinstance(intent.get("arguments"), dict) else {}
    adapter = get_robot_adapter()
    if name == "react":
        return adapter.react(str(arguments.get("emotion", "thoughtful_ack")))
    if name == "look_at":
        return adapter.look_at(str(arguments.get("target", "current_speaker")))
    return None


def dispatch_robot_action(action: str, arguments: dict[str, Any] | None = None) -> RobotActionResult:
    adapter = get_robot_adapter()
    args = arguments or {}
    if action == "status":
        return adapter.status()
    if action == "look_at":
        return adapter.look_at(str(args.get("target", "center")))
    if action == "react":
        return adapter.react(str(args.get("emotion", "thoughtful_ack")))
    if action == "speak":
        return adapter.speak(str(args.get("text", "")))
    if action == "stop":
        return adapter.stop()
    return RobotActionResult(
        ok=False,
        mode=adapter.mode,
        action="status",
        message=f"Unknown robot action: {action}",
        arguments=args,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Tarry robot adapter smoke CLI.")
    parser.add_argument("--action", choices=("status", "look_at", "react", "speak", "stop"), default="status")
    parser.add_argument("--target", default="current_speaker")
    parser.add_argument("--emotion", default="thoughtful_ack")
    parser.add_argument("--text", default="")
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()

    if args.smoke:
        results = [
            dispatch_robot_action("status"),
            dispatch_robot_action("look_at", {"target": args.target}),
            dispatch_robot_action("react", {"emotion": args.emotion}),
            dispatch_robot_action("stop"),
        ]
        print(json.dumps([result.to_json() for result in results], indent=2))
        return 0 if all(result.ok for result in results) else 1

    result = dispatch_robot_action(
        args.action,
        {"target": args.target, "emotion": args.emotion, "text": args.text},
    )
    print(json.dumps(result.to_json(), indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
