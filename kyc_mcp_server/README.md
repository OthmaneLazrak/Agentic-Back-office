# KYC MCP Server

Serveur FastMCP exposant les tools KYC (YOLO / TrOCR / Qwen-VL + LoRA + validateurs métier).

Deux modes :

| Mode | Quand | Coût mémoire |
|---|---|---|
| `stdio` (défaut) | L'agent lance un sous-processus serveur par appel | Les modèles sont rechargés à chaque analyse — **lent et lourd** |
| `sse` (HTTP) | Le serveur tourne en permanence dans un terminal séparé | Modèles chargés **une seule fois**, restent en mémoire |

**Sur un poste avec ≤ 8 GB de RAM, utilise toujours `sse`.**

---

## Démarrer le serveur en mode SSE

Depuis le terminal (PowerShell), à la racine du projet :

```powershell
python kyc_mcp_server\server.py --sse --prewarm
```

- `--sse` active le transport HTTP/SSE sur `http://127.0.0.1:7800/sse`
- `--prewarm` force le chargement de YOLO / TrOCR / Qwen-VL **au boot** (sinon, ils se chargent au premier appel et la première analyse prend ~30s)

Variables d'env utiles :

| Variable | Effet |
|---|---|
| `KYC_MCP_TRANSPORT=sse` | Équivalent à `--sse` |
| `KYC_MCP_PORT=9000` | Change le port |
| `KYC_MCP_PREWARM=1` | Équivalent à `--prewarm` |

Tu verras dans les logs :

```
[Server] Pré-chargement des modèles (warm start)...
[Extractor] Chargement YOLO CIN...
[Extractor] Chargement TrOCR sur cpu...
[Extractor] Chargement Qwen-VL + LoRA sur cpu...
[Server] Modèles prêts.
🟢 Démarrage FastMCP en mode SSE sur http://127.0.0.1:7800/sse
```

Une fois prêt, **laisse ce terminal ouvert** : c'est lui qui héberge les modèles.

---

## Pointer l'agent vers le serveur SSE

L'agent ([kyc_agent/agent.py](../kyc_agent/agent.py)) bascule automatiquement en mode SSE si l'une de ces variables est définie côté Spring/bridge :

```powershell
$env:KYC_MCP_TRANSPORT = "sse"
# (optionnel — par défaut http://127.0.0.1:7800/sse)
# $env:KYC_MCP_URL = "http://127.0.0.1:7800/sse"
```

Définis cette variable **dans le terminal qui lance Spring Boot** :

```powershell
$env:KYC_MCP_TRANSPORT = "sse"
$env:KYC_AGENT_MODEL   = "qwen2.5:3b"
mvn spring-boot:run
```

À chaque "Analyser" depuis le frontend :
- Spring lance `kyc_bridge.py` (subprocess léger)
- `kyc_bridge.py` appelle l'agent LangGraph
- L'agent se connecte en HTTP au serveur déjà en marche → pas de rechargement de modèles

---

## Mode stdio (fallback)

Sans variable d'environnement, l'agent retombe sur stdio : il spawn un MCP server par analyse. Pratique pour Claude Desktop / CLI ; à éviter pour le web sur RAM limitée.

```powershell
# Test stdio depuis CLI :
python kyc_mcp_server\server.py
```

---

## Schéma des transports

```
─── Mode stdio ──────────────────────────────────────────────
Spring → kyc_bridge.py → agent.py → spawn(server.py)  ❌ models reloaded
                                       └─ tools

─── Mode SSE (recommandé) ───────────────────────────────────
        [Terminal A — persistent]
        python server.py --sse --prewarm
        └─ tools (models en mémoire)
                 ▲ HTTP/SSE
                 │
Spring → kyc_bridge.py → agent.py ─┘   ✅ models loaded once
```
