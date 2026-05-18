import contextlib
import json
import os
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: kyc_bridge.py <cin_image> <justificatif_image>", file=sys.stderr)
        return 2

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    sys.path.insert(0, project_root)

    from kyc_mcp_server.tools.extractor import extract_document, extract_justificatif
    from kyc_mcp_server.tools.validator import (
        validate_cin_dossier,
        validate_dossier_complet,
        validate_justificatif_domicile,
    )

    cin_path, justif_path = sys.argv[1], sys.argv[2]

    # Keep model logs out of stdout so Java can parse stdout as pure JSON.
    with contextlib.redirect_stdout(sys.stderr):
        donnees_cin = extract_document(cin_path)
        donnees_justif = extract_justificatif(justif_path)
        validation = validate_dossier_complet(donnees_cin, donnees_justif)
        validation_cin = validate_cin_dossier(donnees_cin)
        validation_justif = validate_justificatif_domicile(donnees_justif)

    print(json.dumps({
        "donnees_cin": donnees_cin,
        "donnees_justif": donnees_justif,
        "validation": validation,
        "validation_cin": validation_cin,
        "validation_justif": validation_justif,
    }, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
