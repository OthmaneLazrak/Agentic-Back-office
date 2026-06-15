package com.awb.kyc.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Correction d'extraction faite par un opérateur Back Office (human-in-the-loop).
 *
 * Chaque ligne = un exemple d'entraînement : l'image d'un document + ce que le
 * modèle avait extrait (avant) + ce que l'opérateur a corrigé (après = vérité terrain).
 *
 * Volontairement DÉCOUPLÉE de {@link KycDossier}/{@link ChequeDossier} : l'image
 * est COPIÉE ici, donc la correction survit à la purge des documents à la décision
 * finale. Le champ {@code exportedAt} permettra à la phase d'export du dataset de
 * ne traiter que les corrections pas encore exportées.
 */
@Entity
@Table(name = "extraction_corrections")
public class ExtractionCorrection {

    public static final String DOMAIN_KYC = "KYC";
    public static final String DOMAIN_CHEQUE = "CHEQUE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** {@link #DOMAIN_KYC} ou {@link #DOMAIN_CHEQUE}. */
    @Column(nullable = false)
    private String domain;

    @Column(name = "dossier_id", nullable = false)
    private Long dossierId;

    /** Type de document corrigé : CIN, JUSTIF (KYC) ou CHEQUE. */
    @Column(name = "document_type", nullable = false)
    private String documentType;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "filename")
    private String filename;

    /** Image du document (copie). Peut être null si l'image n'était plus disponible. */
    @Column(name = "image_data", columnDefinition = "bytea")
    private byte[] imageData;

    /** Champs extraits par le modèle AVANT correction (JSON). */
    @Column(name = "original_json", columnDefinition = "text")
    private String originalJson;

    /** Champs corrigés par l'opérateur APRÈS (JSON) = vérité terrain. */
    @Column(name = "corrected_json", columnDefinition = "text")
    private String correctedJson;

    /** Boîtes corrigées (détection YOLO) : {classe: [x1,y1,x2,y2]} en pixels. */
    @Column(name = "boxes_json", columnDefinition = "text")
    private String boxesJson;

    @Column(name = "corrected_by_user_id")
    private Long correctedByUserId;

    @Column(name = "corrected_by_user_name")
    private String correctedByUserName;

    @Column(name = "corrected_at", nullable = false, updatable = false)
    private LocalDateTime correctedAt;

    /** Renseigné quand la correction a été versée au dataset d'entraînement. */
    @Column(name = "exported_at")
    private LocalDateTime exportedAt;

    @PrePersist
    void onCreate() {
        correctedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public Long getDossierId() {
        return dossierId;
    }

    public void setDossierId(Long dossierId) {
        this.dossierId = dossierId;
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public byte[] getImageData() {
        return imageData;
    }

    public void setImageData(byte[] imageData) {
        this.imageData = imageData;
    }

    public String getOriginalJson() {
        return originalJson;
    }

    public void setOriginalJson(String originalJson) {
        this.originalJson = originalJson;
    }

    public String getCorrectedJson() {
        return correctedJson;
    }

    public void setCorrectedJson(String correctedJson) {
        this.correctedJson = correctedJson;
    }

    public String getBoxesJson() {
        return boxesJson;
    }

    public void setBoxesJson(String boxesJson) {
        this.boxesJson = boxesJson;
    }

    public Long getCorrectedByUserId() {
        return correctedByUserId;
    }

    public void setCorrectedByUserId(Long correctedByUserId) {
        this.correctedByUserId = correctedByUserId;
    }

    public String getCorrectedByUserName() {
        return correctedByUserName;
    }

    public void setCorrectedByUserName(String correctedByUserName) {
        this.correctedByUserName = correctedByUserName;
    }

    public LocalDateTime getCorrectedAt() {
        return correctedAt;
    }

    public LocalDateTime getExportedAt() {
        return exportedAt;
    }

    public void setExportedAt(LocalDateTime exportedAt) {
        this.exportedAt = exportedAt;
    }
}
