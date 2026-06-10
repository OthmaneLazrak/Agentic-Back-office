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
 * Image d'un chèque conservée en base pour permettre la vérification manuelle
 * par le Back Office lorsqu'un dossier est escaladé.
 *
 * Mono-document : un seul {@link #TYPE_CHEQUE} par dossier. Les octets sont
 * stockés en BYTEA et purgés à la décision finale du dossier
 * (voir {@code ChequeService.updateStatus}).
 */
@Entity
@Table(name = "cheque_documents")
public class ChequeDocument {

    public static final String TYPE_CHEQUE = "CHEQUE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dossier_id", nullable = false)
    private Long dossierId;

    /** {@link #TYPE_CHEQUE}. */
    @Column(nullable = false)
    private String type;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "filename")
    private String filename;

    @Column(name = "data", nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getDossierId() {
        return dossierId;
    }

    public void setDossierId(Long dossierId) {
        this.dossierId = dossierId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
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

    public byte[] getData() {
        return data;
    }

    public void setData(byte[] data) {
        this.data = data;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
