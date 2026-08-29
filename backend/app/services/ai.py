import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


async def ask_mochi(system_prompt: str, messages: list[dict]) -> str:

    contents = []

    for message in messages:
        role = "user" if message["role"] == "user" else "model"

        contents.append(
            types.Content(
                role=role,
                parts=[
                    types.Part(
                        text=message["content"]
                    )
                ],
            )
        )

    response = await client.aio.models.generate_content(
        model="gemini-3.6-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
        ),
    )

    return response.text