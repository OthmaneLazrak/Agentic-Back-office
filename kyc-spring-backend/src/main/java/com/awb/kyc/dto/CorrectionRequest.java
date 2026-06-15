package com.awb.kyc.dto;

import java.util.Map;

/**
 * Corrections d'extraction envoyées par le Back Office.
 *
 * {@code documents} mappe un type de document (CIN, JUSTIF, CHEQUE) vers ses
 * champs corrigés. Exemple KYC :
 * <pre>
 * { "documents": {
 *     "CIN":    { "nom": "...", "prenom": "...", "numero_cin": "..." },
 *     "JUSTIF": { "nom": "...", "adresse": "...", "sous_type": "..." }
 * }}
 * </pre>
 * Exemple chèque : {@code { "documents": { "CHEQUE": { "montant_chiffre": "..." } } }}
 */
public class CorrectionRequest {

    private Map<String, Map<String, Object>> documents;

    /**
     * Boîtes corrigées par document : documentType -> { classe: [x1,y1,x2,y2] } (pixels).
     * Optionnel (correction de la détection YOLO). Une correction peut ne porter
     * que sur le texte, que sur les boîtes, ou les deux.
     */
    private Map<String, Object> boxes;

    public Map<String, Map<String, Object>> getDocuments() {
        return documents;
    }

    public void setDocuments(Map<String, Map<String, Object>> documents) {
        this.documents = documents;
    }

    public Map<String, Object> getBoxes() {
        return boxes;
    }

    public void setBoxes(Map<String, Object> boxes) {
        this.boxes = boxes;
    }
}
