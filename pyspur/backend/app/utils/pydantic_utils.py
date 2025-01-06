from typing import Any
from pydantic import BaseModel


def get_nested_field(field_name_with_dots: str, model: BaseModel) -> Any:
    """
    Get the value of a nested field from a Pydantic model.
    """
    field_names = field_name_with_dots.split(".")
    value = model
    for field_name in field_names:
        value = getattr(value, field_name)
    return value


def get_jinja_template_for_model(model: BaseModel) -> str:
    """
    Generate a Jinja template for a Pydantic model.
    """
    template = "{\n"
    for field_name, _field in model.model_fields.items():
        template += f'"{field_name}": {{{{field_name}}}},\n'
    template += "}"
    return template
