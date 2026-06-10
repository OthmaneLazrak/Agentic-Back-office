# Cheque MCP Server

Serveur FastMCP exposant les tools CHÈQUE (Qwen2-VL + LoRA / YOLO / TrOCR + validation métier).

Même structure que [kyc_mcp_server](../kyc_mcp_server/) :

```
cheque_mcp_server/
  server.py                 # entrée FastMCP (stdio | sse), orchestre les tools
  tools/
    extractor.py            # chargement modèles + extraction (VLM, YOLO, TrOCR)
    validator.py            # validate_cheque -> {statut, message, erreurs}
    reporter.py             # generer_rapport -> rapport JSON horodaté
  cheque_qwen_lora_final/   # adaptateur LoRA Qwen2-VL (manuscrit)
  modele_final/best.pt      # poids YOLO (num_compte, signature, cmc7)
```

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
python cheque_mcp_server\server.py --sse --prewarm
```

- `--sse` active le transport HTTP/SSE sur `http://127.0.0.1:7810/sse`
- `--prewarm` force le chargement de Qwen-VL / YOLO / TrOCR **au boot** (sinon, ils se chargent au premier appel et la première analyse prend ~30s)

Variables d'env utiles :

| Variable | Effet |
|---|---|
| `CHEQUE_MCP_TRANSPORT=sse` | Équivalent à `--sse` |
| `CHEQUE_MCP_PORT=9000` | Change le port (défaut 7810) |
| `CHEQUE_MCP_PREWARM=1` | Équivalent à `--prewarm` |
| `CHEQUE_VLM_DTYPE=fp32\|fp16\|bf16` | dtype du VLM sur CPU (défaut fp32) |

Tu verras dans les logs :

```
[Server] Pré-chargement des modèles (warm start)...
[Extractor] Chargement de Qwen2-VL + LoRA sur cpu...
[Extractor] Chargement YOLO chèque...
[Extractor] Chargement TrOCR sur cpu...
[Server] Modèles prêts.
🟢 Démarrage FastMCP en mode SSE sur http://127.0.0.1:7810/sse
```

Une fois prêt, **laisse ce terminal ouvert** : c'est lui qui héberge les modèles.

---

## Pointer l'agent vers le serveur SSE

L'agent ([cheque_agent/agent.py](../cheque_agent/agent.py)) bascule automatiquement en mode SSE si l'une de ces variables est définie :

```powershell
$env:CHEQUE_MCP_TRANSPORT = "sse"
# (optionnel — par défaut http://127.0.0.1:7810/sse)
# $env:CHEQUE_MCP_URL = "http://127.0.0.1:7810/sse"
```

Définis cette variable **dans le terminal qui lance le Python Agent Server / Spring**.

---

## Tools exposés

| Tool | Rôle |
|---|---|
| `extraire_manuscrit_cheque(chemin_image)` | VLM → `montant_chiffre`, `montant_lettre`, `beneficiaire` |
| `extraire_zones_cheque(chemin_image)` | YOLO + TrOCR → `num_compte`, `signature`, `cmc7` |
| `analyser_cheque_complet(chemin_image)` | Pipeline complet → `donnees_manuscrit`, `donnees_zones`, `validation` |

`analyser_cheque_complet` est l'outil appelé par l'agent LangGraph.

---

## Mode stdio (fallback)

Sans variable d'environnement, l'agent retombe sur stdio : il spawn un MCP server par analyse.

```powershell
# Test stdio depuis CLI :
python cheque_mcp_server\server.py
```

---

## Schéma des transports

```
─── Mode stdio ──────────────────────────────────────────────
api_server.py → cheque_agent → spawn(server.py)  ❌ models reloaded
                                  └─ tools

─── Mode SSE (recommandé) ───────────────────────────────────
        [Terminal A — persistent]
        python server.py --sse --prewarm
        └─ tools (models en mémoire)
                 ▲ HTTP/SSE
                 │
api_server.py → cheque_agent ─┘   ✅ models loaded once
```
