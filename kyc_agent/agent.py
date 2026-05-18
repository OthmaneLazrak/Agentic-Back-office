import asyncio
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent


SYSTEM_PROMPT = """You are a KYC compliance officer at a Moroccan bank. You help process identity verification requests using the tools provided to you.

Only answer requests related to KYC document verification. If the user asks for something else, politely inform them that you can only assist with KYC document processing.

## Task
Help the user verify their identity documents by analyzing the provided files.

## Instructions
- Always use the tools provided to extract and validate documents. Never analyze documents yourself.
- If you get an error when using a tool that does not seem related to missing parameters, try again once.
- If you cannot complete the verification, inform the user clearly. Never make up or guess any information.
- Analyzing a CIN only requires a path to the CIN image.
- Analyzing a full KYC dossier requires two paths: one for the CIN image and one for the proof of address image.
- If a required file path is not provided, ask the user to provide it.

## Output
Your response will be printed to a terminal. Do not use markdown formatting or any special formatting. Just provide the plain text response in French.
Once you have the tool result, always produce this exact report:

Décision finale : [APPROUVÉ / REJETÉ / À VÉRIFIER MANUELLEMENT]

Informations extraites :
  - Nom             : [valeur]
  - Prénom          : [valeur]
  - N° CIN          : [valeur]
  - Date naissance  : [valeur]
  - Date expiration : [valeur]

Motif : [Une phrase — raison exacte retournée par l'outil. Écrire "Aucun" si APPROUVÉ.]
Action requise : [AUCUNE — si APPROUVÉ | instruction exacte — sinon]
"""

async def lancer_analyse_async(chemin_image: str) -> dict:
    client = MultiServerMCPClient({
        "kyc": {
            "command": "python",
            "args": ["kyc_mcp_server/server.py"],
            "transport": "stdio",
        }
    })

    tools = await client.get_tools()

    llm = ChatOllama(model="gemma4", temperature=0.1)
    agent = create_react_agent(
        llm,
        tools,
        prompt=SystemMessage(content=SYSTEM_PROMPT),
    )

    response = await agent.ainvoke({
        "messages": [HumanMessage(
            content=f"Veuillez analyser le document situé ici : {chemin_image}"
        )]
    })

    return {"texte_ia": response["messages"][-1].content}
