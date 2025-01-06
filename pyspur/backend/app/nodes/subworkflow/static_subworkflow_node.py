from typing import Any, Dict

from pydantic import BaseModel

from ...schemas.workflow_schemas import WorkflowDefinitionSchema

from ...execution.workflow_executor import WorkflowExecutor
from .base_subworkflow_node import BaseSubworkflowNode
from ...models.workflow_model import WorkflowModel
from ...api.workflow_run import run_workflow_blocking, StartRunRequestSchema
from ...database import get_db


class StaticSubworkflowNodeConfig(BaseModel):
    workflow_id: str = ""


class StaticSubworkflowNode(BaseSubworkflowNode):
    name: str = "static_workflow_node"
    config_model = StaticSubworkflowNodeConfig

    def setup(self) -> None:
        if self.context is None:
            # context less execution
            with next(get_db()) as db:
                workflow_model = (
                    db.query(WorkflowModel)
                    .filter(WorkflowModel.id == self.config.workflow_id)
                    .first()
                )
                if workflow_model is None:
                    raise ValueError(
                        f"Workflow with id {self.config.workflow_id} not found"
                    )
                self.subworkflow = WorkflowDefinitionSchema.model_validate(
                    workflow_model.definition
                )
            return super().setup()
        else:
            # context aware execution
            workflow_id = self.config.workflow_id
            workflow_model = (
                self.context.db_session.query(WorkflowModel)
                .filter(WorkflowModel.id == workflow_id)
                .first()
            )
            if workflow_model is None:
                raise ValueError(f"Workflow with id {workflow_id} not found")
            self.subworkflow = WorkflowDefinitionSchema.model_validate(
                workflow_model.definition
            )
            return super().setup()

    async def run(self, input_data: BaseModel) -> BaseModel:
        assert self.subworkflow is not None
        context = self.context
        # initial inputs is <input_node_id>: {<input_field_name>: <input_value>}
        initial_inputs: Dict[str, Dict[str, Any]] = {}
        input_data_dict = input_data.model_dump()
        input_node_id = [
            node.id for node in self.subworkflow.nodes if node.node_type == "InputNode"
        ][0]
        initial_inputs[input_node_id] = input_data_dict

        if context is None:
            # context less execution
            executor = WorkflowExecutor(self.subworkflow)
            outputs = await executor(initial_inputs)
        else:
            # prepare the initial inputs for the workflow
            request = StartRunRequestSchema(
                initial_inputs=initial_inputs,
                parent_run_id=context.run_id,
            )

            # Run the workflow
            outputs = await run_workflow_blocking(
                workflow_id=self.config.workflow_model.id,
                request=request,
                db=context.db_session,
                run_type=context.run_type,
            )
        return self._transform_workflow_output_to_node_output(outputs)


if __name__ == "__main__":
    # Example usage of the SubworkflowNode
    workflow_json = """
{
    "nodes": [
      {
        "id": "0",
        "node_type": "InputNode",
        "config": {
          "input_schema": {
            "user_message": "str",
            "city": "str",
            "units": "str",
            "joke_instruction": "str",
            "joke_setup": "str"
          }
        }
      },
      {
        "id": "1",
        "node_type": "SingleLLMCallNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 150,
          "temperature": 0.7,
          "system_message": "please provide average annual weather for the city",
          "output_schema": { "city": "str",
            "weather": "str",
            "temperature": "float",
            "humidity": "int",
            "feels_like": "float",
            "precipitation": "float"
          },
          "input_schema": { "user_message": "str", "city":"str", "units":"str" },
          "user_message": "City: {{city}}, Units: {{units}}, User Message: {{user_message}}"
        }
      },
      {
        "id": "3",
        "node_type": "BestOfNNode",
        "config": {
          "llm_name": "gpt-4o",
          "max_tokens": 150,
          "temperature": 0.7,
          "system_message": "please provide average annual weather for {{city}} in {{units}}",
          "output_schema": { "general_weather_guidelines": "str", "average_annual_temperature": "float" },
          "input_schema": { "user_message": "str", "city":"str", "units":"str" },
          "samples": 5
        }
      },
      {
        "id": "2",
        "node_type": "PythonFuncNode",
        "config": {
          "code": "import time\\ntime.sleep(1)\\nresult = number *2\\n",
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
          "system_message": "You are Jimmy Carr. Your jokes are intelligent and funny. Your task is to create a joke for the user's instruction",
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
            "source_id": "0",
            "source_output_key": "user_message",
            "target_id": "1",
            "target_input_key": "user_message"
        },
        {
            "source_id": "0",
            "source_output_key": "city",
            "target_id": "1",
            "target_input_key": "city"
        },
        {
            "source_id": "0",
            "source_output_key": "units",
            "target_id": "1",
            "target_input_key": "units"
        },
        {
            "source_id": "0",
            "source_output_key": "user_message",
            "target_id": "3",
            "target_input_key": "user_message"
        },
        {
            "source_id": "0",
            "source_output_key": "city",
            "target_id": "3",
            "target_input_key": "city"
        },
        {
            "source_id": "0",
            "source_output_key": "units",
            "target_id": "3",
            "target_input_key": "units"
        },
        {
            "source_id": "0",
            "source_output_key": "joke_instruction",
            "target_id": "4",
            "target_input_key": "user_message"
        },
        {
            "source_id": "0",
            "source_output_key": "joke_setup",
            "target_id": "5",
            "target_input_key": "user_message"
        },
        {
            "source_id": "1",
            "source_output_key": "temperature",
            "target_id": "2",
            "target_input_key": "number"
        }
    ]
  }"""
    input_data = {
        "user_message": "okay, give it to me",
        "city": "Jabalpur",
        "units": "celsius",
        "joke_setup": "Why do politicians and actors not like to ride shotgun?",
        "joke_instruction": "Complete this joke like Jimmy Carr: Why do politicians and actors not like to ride shotgun?",
    }

    node = StaticSubworkflowNode(config=StaticSubworkflowNodeConfig(workflow_id="S1"))
    import asyncio

    output = asyncio.run(node(input_data))
    print(output)
    print("-" * 50)
#     # Example usage of the SubworkflowNode for generating high-quality ad copy
#     workflow_json = """
# {
#     "nodes": [
#         {
#             "id": "1",
#             "node_type": "BranchSolveMergeNode",
#             "config": {
#                 "llm_name": "gpt-4o",
#                 "max_tokens": 100,
#                 "temperature": 0.7,
#                 "system_message": "You are an expert copywriter. Break down the task of creating an ad header into sub-tasks and solve them.",
#                 "input_schema": {
#                     "product_description": "str"
#                 },
#                 "output_schema": {
#                     "header": "str"
#                 }
#             }
#         },
#         {
#             "id": "2",
#             "node_type": "BranchSolveMergeNode",
#             "config": {
#                 "llm_name": "gpt-4o",
#                 "max_tokens": 150,
#                 "temperature": 0.7,
#                 "system_message": "You are an expert copywriter. Break down the task of creating an ad sub-header into sub-tasks and solve them.",
#                 "input_schema": {
#                     "product_description": "str",
#                     "header": "str"
#                 },
#                 "output_schema": {
#                     "sub_header": "str"
#                 }
#             }
#         },
#         {
#             "id": "3",
#             "node_type": "MCTSNode",
#             "config": {
#                 "llm_name": "gpt-4o",
#                 "max_tokens": 50,
#                 "temperature": 0.7,
#                 "system_message": "You are a creative director reviewing ad headers. Generate variations and select the best one that doesn't overuse 'Elevate' or 'Delve'.",
#                 "num_simulations": 5,
#                 "simulation_depth": 3
#             }
#         }
#     ],
#     "links": [
#         {
#             "source_id": "1",
#             "source_output_key": "header",
#             "target_id": "2",
#             "target_input_key": "header"
#         },
#         {
#             "source_id": "1",
#             "source_output_key": "header",
#             "target_id": "3",
#             "target_input_key": "user_message"
#         }
#     ]
# }"""

#     input_data = {
#         "1__product_description": 'Dash Sparkling Water is a refreshing beverage made by infusing naturally flavored fruits and vegetables with sparkling water. It\'s free from sugars, sweeteners, and artificial additives, making it a clean and healthy choice for hydration. Dash prides itself on using "wonky" or imperfect produce, reducing food waste while providing a light and subtle flavor. Popular flavors include cucumber, lemon, raspberry, and peach, offering a crisp, refreshing taste. The minimalist ingredients and eco-conscious approach make Dash a go-to choice for those seeking a guilt-free, delicious alternative to sugary soft drinks or overly sweet sparkling waters.',
#         "2__product_description": 'Dash Sparkling Water is a refreshing beverage made by infusing naturally flavored fruits and vegetables with sparkling water. It\'s free from sugars, sweeteners, and artificial additives, making it a clean and healthy choice for hydration. Dash prides itself on using "wonky" or imperfect produce, reducing food waste while providing a light and subtle flavor. Popular flavors include cucumber, lemon, raspberry, and peach, offering a crisp, refreshing taste. The minimalist ingredients and eco-conscious approach make Dash a go-to choice for those seeking a guilt-free, delicious alternative to sugary soft drinks or overly sweet sparkling waters.',
#     }

#     node = SubworkflowNode(config=SubworkflowNodeConfig(workflow_json=workflow_json))
#     import asyncio

#     output = asyncio.run(node(input_data))
#     print(json.dumps(output.model_dump(), indent=2))
