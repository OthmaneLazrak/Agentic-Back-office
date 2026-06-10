package com.awb.kyc.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Dossier d'analyse d'un chèque (équivalent {@link KycDossier} côté chèque).
 *
 * Mono-document : un seul chèque par dossier. Les champs métier reflètent la
 * sortie du pipeline ({@code donnees_manuscrit} / {@code donnees_zones} /
 * {@code validation}) plutôt que les champs CIN/justificatif du KYC.
 */
@Entity
@Table(name = "cheque_dossiers")
public class ChequeDossier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filename;

    @Column(name = "montant_chiffre")
    private String montantChiffre;

    @Column(name = "montant_lettre")
    private String montantLettre;

    private String beneficiaire;

    @Column(name = "num_compte")
    private String numCompte;

    @Column(name = "cmc7")
    private String cmc7;

    @Column(name = "signature_present")
    private Boolean signaturePresent;

    @Column(name = "decision_ia")
    private String decisionIa;

    @Column(name = "decision_back_office")
    private String decisionBackOffice;

    @Column(name = "motif_back_office", columnDefinition = "text")
    private String motifBackOffice;

    @Column(name = "decided_back_office_at")
    private LocalDateTime decidedBackOfficeAt;

    private String statut = "PENDING";

    @Column(columnDefinition = "text")
    private String motif;

    @Column(name = "agent_report", columnDefinition = "text")
    private String agentReport;

    /**
     * Résultat complet de l'analyse sérialisé en JSON (données extraites, zones,
     * checks, erreurs, décision, risque) pour relecture à l'escalade.
     */
    @Column(name = "analysis_json", columnDefinition = "text")
    private String analysisJson;

    @Column(name = "risk_score")
    private Integer riskScore;

    @Column(name = "created_by_role")
    private String createdByRole;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "created_by_user_name")
    private String createdByUserName;

    @Column(name = "escalated_by_role")
    private String escalatedByRole;

    @Column(name = "escalated_by_user_id")
    private Long escalatedByUserId;

    @Column(name = "escalated_by_user_name")
    private String escalatedByUserName;

    @Column(name = "handled_by_role")
    private String handledByRole;

    @Column(name = "handled_by_user_id")
    private Long handledByUserId;

    @Column(name = "handled_by_user_name")
    private String handledByUserName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getMontantChiffre() {
        return montantChiffre;
    }

    public void setMontantChiffre(String montantChiffre) {
        this.montantChiffre = montantChiffre;
    }

    public String getMontantLettre() {
        return montantLettre;
    }

    public void setMontantLettre(String montantLettre) {
        this.montantLettre = montantLettre;
    }

    public String getBeneficiaire() {
        return beneficiaire;
    }

    public void setBeneficiaire(String beneficiaire) {
        this.beneficiaire = beneficiaire;
    }

    public String getNumCompte() {
        return numCompte;
    }

    public void setNumCompte(String numCompte) {
        this.numCompte = numCompte;
    }

    public String getCmc7() {
        return cmc7;
    }

    public void setCmc7(String cmc7) {
        this.cmc7 = cmc7;
    }

    public Boolean getSignaturePresent() {
        return signaturePresent;
    }

    public void setSignaturePresent(Boolean signaturePresent) {
        this.signaturePresent = signaturePresent;
    }

    public String getDecisionIa() {
        return decisionIa;
    }

    public void setDecisionIa(String decisionIa) {
        this.decisionIa = decisionIa;
    }

    public String getDecisionBackOffice() {
        return decisionBackOffice;
    }

    public void setDecisionBackOffice(String decisionBackOffice) {
        this.decisionBackOffice = decisionBackOffice;
    }

    public String getMotifBackOffice() {
        return motifBackOffice;
    }

    public void setMotifBackOffice(String motifBackOffice) {
        this.motifBackOffice = motifBackOffice;
    }

    public LocalDateTime getDecidedBackOfficeAt() {
        return decidedBackOfficeAt;
    }

    public void setDecidedBackOfficeAt(LocalDateTime decidedBackOfficeAt) {
        this.decidedBackOfficeAt = decidedBackOfficeAt;
    }

    public String getStatut() {
        return statut;
    }

    public void setStatut(String statut) {
        this.statut = statut;
    }

    public String getMotif() {
        return motif;
    }

    public void setMotif(String motif) {
        this.motif = motif;
    }

    public String getAgentReport() {
        return agentReport;
    }

    public void setAgentReport(String agentReport) {
        this.agentReport = agentReport;
    }

    public String getAnalysisJson() {
        return analysisJson;
    }

    public void setAnalysisJson(String analysisJson) {
        this.analysisJson = analysisJson;
    }

    public Integer getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(Integer riskScore) {
        this.riskScore = riskScore;
    }

    public String getCreatedByRole() {
        return createdByRole;
    }

    public void setCreatedByRole(String createdByRole) {
        this.createdByRole = createdByRole;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public String getCreatedByUserName() {
        return createdByUserName;
    }

    public void setCreatedByUserName(String createdByUserName) {
        this.createdByUserName = createdByUserName;
    }

    public String getEscalatedByRole() {
        return escalatedByRole;
    }

    public void setEscalatedByRole(String escalatedByRole) {
        this.escalatedByRole = escalatedByRole;
    }

    public Long getEscalatedByUserId() {
        return escalatedByUserId;
    }

    public void setEscalatedByUserId(Long escalatedByUserId) {
        this.escalatedByUserId = escalatedByUserId;
    }

    public String getEscalatedByUserName() {
        return escalatedByUserName;
    }

    public void setEscalatedByUserName(String escalatedByUserName) {
        this.escalatedByUserName = escalatedByUserName;
    }

    public String getHandledByRole() {
        return handledByRole;
    }

    public void setHandledByRole(String handledByRole) {
        this.handledByRole = handledByRole;
    }

    public Long getHandledByUserId() {
        return handledByUserId;
    }

    public void setHandledByUserId(Long handledByUserId) {
        this.handledByUserId = handledByUserId;
    }

    public String getHandledByUserName() {
        return handledByUserName;
    }

    public void setHandledByUserName(String handledByUserName) {
        this.handledByUserName = handledByUserName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
