"""Operator legacy tools — write tools must be classified as write_prep."""

from app.services.agent.operator_agent_tools import _OPERATOR_WRITE_TOOL_NAMES, register_operator_tools
from app.services.agent.tool_registry import AGENT_TOOL_REGISTRY, get_tool_definition


def test_operator_write_tools_are_write_prep():
    register_operator_tools()
    for name in _OPERATOR_WRITE_TOOL_NAMES:
        tool = get_tool_definition(name)
        assert tool is not None, name
        assert tool.kind == "write_prep", name

    read_sample = get_tool_definition("get_work_order_deep")
    assert read_sample is not None
    assert read_sample.kind == "read"
