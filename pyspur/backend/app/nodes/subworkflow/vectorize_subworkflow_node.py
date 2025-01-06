import asyncio
from typing import Any, Awaitable, Dict, List

from pydantic import BaseModel, create_model

from ..base import BaseNode
from .static_subworkflow_node import (
    StaticSubworkflowNode,
    StaticSubworkflowNodeConfig,
)


class VectorizeSubworkflowNodeConfig(StaticSubworkflowNodeConfig):
    pass


class VectorizeSubworkflowNode(BaseNode):
    """
    Vectorizes a subworkflow node by running it on a list of inputs in parallel.
    """

    name: str = "Vectorize_subworkflow_node"
    config_model = VectorizeSubworkflowNodeConfig

    def setup(self) -> None:
        config = self.config
        self.subworkflow_node = StaticSubworkflowNode(config=config)

        # the input and output schemas of the vectorized node
        # they have the same keys as the subworkflow node but the values are lists of the original type

        # Build input_model with fields being lists of the subworkflow_node's input_model fields
        input_fields: Dict[str, Any] = {}
        for field_name, field in self.subworkflow_node.input_model.model_fields.items():
            field_type = field.annotation
            if field_type is None:
                continue
            input_fields[field_name] = (List[field_type], ...)

        self.input_model = create_model(
            f"{self.name}Input",
            **input_fields,
        )

        # Build output_model with fields being lists of the subworkflow_node's output_model fields
        output_fields: Dict[str, Any] = {}
        for (
            field_name,
            field,
        ) in self.subworkflow_node.output_model.model_fields.items():
            field_type = field.annotation
            if field_type is None:
                continue
            output_fields[field_name] = (List[field_type], ...)

        self.output_model = create_model(
            f"{self.name}Output",
            **output_fields,
        )

    async def run(self, input_data: BaseModel) -> BaseModel:
        # Run the subworkflow node on each input in parallel
        subworkflow_tasks: List[Awaitable[BaseModel]] = []
        input_data_dict = input_data.model_dump()
        for i in range(len(input_data_dict[list(input_data_dict.keys())[0]])):
            input_data_i = {k: v[i] for k, v in input_data_dict.items()}
            subworkflow_tasks.append(self.subworkflow_node(input_data_i))

        results = await asyncio.gather(*subworkflow_tasks)
        stacked_results: Dict[str, List[Any]] = {}
        for output_name in self.output_model.model_fields.keys():
            stacked_results[output_name] = [
                getattr(result, output_name) for result in results
            ]
        return self.output_model.model_validate(stacked_results)


if __name__ == "__main__":
    # Example usage of the SubworkflowNode
    n_parallel = 2
    workflow_json = """
{
    "nodes": [
      {
        "id": "1",
        "node_type": "AdvancedLLMNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 150,
          "temperature": 0.7,
          "system_prompt": "please provide average annual weather for {city}",
          "output_schema": { "city": "str",
            "weather": "str",
            "temperature": "float",
            "humidity": "int",
            "feels_like": "float",
            "precipitation": "float"
          },
          "input_schema": { "user_message": "str", "city":"str", "units":"str" }
        }
      },
      {
        "id": "3",
        "node_type": "BestOfNNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 150,
          "temperature": 0.7,
          "system_prompt": "please provide average annual weather for {city} in {units}",
          "output_schema": { "general_weather_guidelines": "str", "average_annual_temperature": "float" },
          "input_schema": { "user_message": "str", "city":"str", "units":"str" },
          "samples": 5
        }
      },
      {
        "id": "2",
        "node_type": "PythonFuncNode",
        "config": {
          "code": "import time\\ntime.sleep(1)\\noutput_data = {'result': input_data['number'] * 2}",
          "input_schema": {
            "number": "float"
          },
          "output_schema": {
            "result": "float"
          }
        }
      },
      {
        "id": "4",
        "node_type": "MCTSNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 2048,
          "temperature": 0.7,
          "system_prompt": "You are Jimmy Carr. Your jokes are intelligent and funny. Your task is to create a joke for the user's instruction",
          "num_simulations": 5,
          "simulation_depth": 10
        }
      },
      {
        "id": "5",
        "node_type": "BranchSolveMergeNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 2048,
          "temperature": 0.7,
          "input_schema": {"user_message": "str"},
          "output_schema": {"complete_joke": "str"}
        }
      }

    ],
    "links": [
      {
        "source_id": "1",
        "source_output_key": "temperature",
        "target_id": "2",
        "target_input_key": "number"
      }
    ]
  }"""
    input_data = {
        "1__user_message": "okay, give it to me",
        "1__city": "Jabalpur",
        "1__units": "celsius",
        "3__user_message": "please enlighten me",
        "3__city": "Jabalpur",
        "3__units": "celsius",
        "4__user_message": "Why do politicians and actors not like to ride shotgun?",
        "5__user_message": "Complete this joke like Jimmy Carr: Why do politicians and actors not like to ride shotgun?",
    }
    input_data = {k: [v] * n_parallel for k, v in input_data.items()}
    node = VectorizeSubworkflowNode(VectorizeSubworkflowNodeConfig(workflow_id="S1"))
    print("Input model:")
    print(node.input_model.model_json_schema())
    print("-" * 50)
    print("Output model:")
    print(node.output_model.model_json_schema())
    print("-" * 50)
    output = asyncio.run(node(input_data))
    print(output)
