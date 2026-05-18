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

@Entity
@Table(name = "kyc_dossiers")
public class KycDossier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filename;
    private String nom;
    private String prenom;
    private String cin;

    @Column(name = "decision_ia")
    private String decisionIa;

    private String statut = "PENDING";

    @Column(columnDefinition = "text")
    private String motif;

    @Column(name = "agent_report", columnDefinition = "text")
    private String agentReport;

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

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getPrenom() {
        return prenom;
    }

    public void setPrenom(String prenom) {
        this.prenom = prenom;
    }

    public String getCin() {
        return cin;
    }

    public void setCin(String cin) {
        this.cin = cin;
    }

    public String getDecisionIa() {
        return decisionIa;
    }

    public void setDecisionIa(String decisionIa) {
        this.decisionIa = decisionIa;
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
