package com.awb.kyc.service;

import com.awb.kyc.entity.ChequeDocument;
import com.awb.kyc.entity.ChequeDossier;
import com.awb.kyc.entity.ExtractionCorrection;
import com.awb.kyc.entity.KycUser;
import com.awb.kyc.repository.ChequeDocumentRepository;
import com.awb.kyc.repository.ChequeDossierRepository;
import com.awb.kyc.repository.ExtractionCorrectionRepository;
import com.awb.kyc.repository.KycUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service métier des dossiers chèque (équivalent {@link KycService} côté chèque).
 *
 * Mono-document : un seul chèque par analyse. La sortie du pipeline
 * (donnees_manuscrit / donnees_zones / validation) est mappée vers un payload
 * front stable, persistée, puis exposée aux décisions opérateur.
 */
@Service
public class ChequeService {

    private static final List<String> ACCEPTED_TYPES = List.of("image/jpeg", "image/png", "image/jpg");

    private final ChequeDossierRepository repository;
    private final KycUserRepository userRepository;
    private final ChequeDocumentRepository documentRepository;
    private final ExtractionCorrectionRepository correctionRepository;
    private final ChequeAiOrchestratorService aiOrchestrator;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;

    public ChequeService(
            ChequeDossierRepository repository,
            KycUserRepository userRepository,
            ChequeDocumentRepository documentRepository,
            ExtractionCorrectionRepository correctionRepository,
            ChequeAiOrchestratorService aiOrchestrator,
            ObjectMapper objectMapper,
            @Value("${kyc.upload-dir}") String uploadDir
    ) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.correctionRepository = correctionRepository;
        this.aiOrchestrator = aiOrchestrator;
        this.objectMapper = objectMapper;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @Transactional
    public Map<String, Object> analyze(MultipartFile file, Long actorUserId) {
        validateUpload(file, "Chèque");
        KycUser actor = resolveUser(actorUserId, "FRONT_OFFICE");

        Path chequePath = null;
        try {
            Files.createDirectories(uploadDir);
            chequePath = uploadDir.resolve("cheque_" + UUID.randomUUID() + "_" + cleanFilename(file.getOriginalFilename()));
            Files.copy(file.getInputStream(), chequePath, StandardCopyOption.REPLACE_EXISTING);

            JsonNode result = aiOrchestrator.analyze(chequePath);

            String decision = text(result.at("/validation/statut"), "A VERIFIER MANUELLEMENT");
            String normalizedDecision = stripAccents(decision);
            JsonNode errorsNode = result.at("/validation/erreurs");
            JsonNode manuscrit = result.path("donnees_manuscrit");
            JsonNode zones = result.path("donnees_zones");

            JsonNode signatureNode = zones.path("signature");
            JsonNode numCompteNode = zones.path("num_compte");
            JsonNode cmc7Node = zones.path("cmc7");

            String montantChiffre = text(manuscrit.path("montant_chiffre"), "");
            String montantLettre = text(manuscrit.path("montant_lettre"), "");
            String beneficiaire = text(manuscrit.path("beneficiaire"), "");
            String numCompteText = text(numCompteNode.path("text"), "");
            String cmc7Text = text(cmc7Node.path("text"), "");
            boolean signaturePresent = signatureNode.path("present").asBoolean(false);
            boolean numCompteDetected = !numCompteNode.path("crop").isMissingNode() && !numCompteNode.path("crop").isNull();
            boolean cmc7Detected = !cmc7Node.path("crop").isMissingNode() && !cmc7Node.path("crop").isNull();

            boolean valide = "VALIDE".equals(normalizedDecision);
            boolean rejete = "REJETE".equals(normalizedDecision);
            int riskScore = valide ? 25 : rejete ? 80 : 55;
            String riskLevel = riskScore < 40 ? "low" : riskScore < 70 ? "medium" : "high";

            String agentTextFromLlm = text(result.path("agent_text"), "");
            String agentReport = agentTextFromLlm.isBlank()
                    ? buildAgentReport(decision, result.path("validation"), errorsNode, manuscrit, signaturePresent, numCompteDetected, cmc7Detected)
                    : agentTextFromLlm;

            Map<String, Object> extracted = new LinkedHashMap<>();
            extracted.put("montant_chiffre", montantChiffre);
            extracted.put("montant_lettre", montantLettre);
            extracted.put("beneficiaire", beneficiaire);
            extracted.put("num_compte", numCompteText);
            extracted.put("cmc7", cmc7Text);
            extracted.put("signature_present", signaturePresent);

            Map<String, Object> checks = new LinkedHashMap<>();
            checks.put("montant_chiffre", check("Montant (chiffres)", isFilled(montantChiffre) ? "Lisible" : "Illisible", isFilled(montantChiffre) ? "success" : "error"));
            checks.put("montant_lettre", check("Montant (lettres)", isFilled(montantLettre) ? "Lisible" : "Illisible", isFilled(montantLettre) ? "success" : "error"));
            checks.put("beneficiaire", check("Bénéficiaire", isFilled(beneficiaire) ? "Détecté" : "Absent", isFilled(beneficiaire) ? "success" : "error"));
            checks.put("num_compte", check("N° de compte", numCompteDetected ? (isFilled(numCompteText) ? "Lisible" : "Illisible") : "Non détecté", numCompteDetected && isFilled(numCompteText) ? "success" : "warning"));
            checks.put("signature", check("Signature", signaturePresent ? "Présente" : "Absente", signaturePresent ? "success" : "error"));
            checks.put("cmc7", check("Bande CMC7", cmc7Detected ? (isFilled(cmc7Text) ? "Lisible" : "Illisible") : "Non détectée", cmc7Detected && isFilled(cmc7Text) ? "success" : "warning"));

            // Snapshot complet de l'analyse, resservi tel quel au Back Office à l'escalade.
            Map<String, Object> analysis = new LinkedHashMap<>();
            analysis.put("decision", decision);
            analysis.put("risk_score", riskScore);
            analysis.put("risk_level", riskLevel);
            analysis.put("extracted", extracted);
            analysis.put("checks", checks);
            analysis.put("errors", errorsNode.isArray() ? errorsNode : List.of());

            // Boîtes YOLO (+ taille image) du chèque -> correction de la détection au Back Office.
            Map<String, Object> chequeBoxes = new LinkedHashMap<>();
            for (String z : List.of("num_compte", "cmc7", "signature")) {
                JsonNode bx = zones.path(z).path("box");
                if (bx.isArray()) {
                    chequeBoxes.put(z, bx);
                }
            }
            Map<String, Object> boxes = new LinkedHashMap<>();
            if (!chequeBoxes.isEmpty()) {
                boxes.put(ChequeDocument.TYPE_CHEQUE, chequeBoxes);
            }
            analysis.put("boxes", boxes);
            Map<String, Object> imageSizes = new LinkedHashMap<>();
            if (zones.path("_image_size").isArray()) {
                imageSizes.put(ChequeDocument.TYPE_CHEQUE, zones.path("_image_size"));
            }
            analysis.put("image_sizes", imageSizes);

            ChequeDossier dossier = new ChequeDossier();
            dossier.setFilename(file.getOriginalFilename());
            dossier.setMontantChiffre(montantChiffre);
            dossier.setMontantLettre(montantLettre);
            dossier.setBeneficiaire(beneficiaire);
            dossier.setNumCompte(numCompteText);
            dossier.setCmc7(cmc7Text);
            dossier.setSignaturePresent(signaturePresent);
            dossier.setDecisionIa(decision);
            dossier.setStatut("PENDING");
            dossier.setAgentReport(agentReport);
            dossier.setRiskScore(riskScore);
            dossier.setAnalysisJson(writeJsonQuietly(analysis));
            dossier.setCreatedByRole(actor.getType());
            dossier.setCreatedByUserId(actor.getId());
            dossier.setCreatedByUserName(fullName(actor));
            repository.saveAndFlush(dossier);

            // Conserver l'image du chèque en base pour la vérification manuelle Back Office.
            saveDocument(dossier.getId(), ChequeDocument.TYPE_CHEQUE, file);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "success");
            response.put("decision", decision);
            response.put("risk_score", riskScore);
            response.put("risk_level", riskLevel);
            response.put("extracted", extracted);
            response.put("checks", checks);
            response.put("dossier_id", dossier.getId());
            response.put("errors", errorsNode.isArray() ? errorsNode : List.of());
            response.put("agent_report", agentReport);
            response.put("filename", file.getOriginalFilename());

            return response;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur sauvegarde fichier: " + e.getMessage(), e);
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur interne: " + e.getMessage(), e);
        } finally {
            deleteQuietly(chequePath);
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listDossiers(String statut) {
        List<ChequeDossier> dossiers = (statut == null || statut.isBlank())
                ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findByStatutOrderByCreatedAtDesc(statut.toUpperCase());

        return dossiers.stream()
                .map(this::toDossierResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChequeDocument getDocument(Long dossierId, String type) {
        String normalizedType = type == null ? "" : type.trim().toUpperCase();
        if (!ChequeDocument.TYPE_CHEQUE.equals(normalizedType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type de document invalide (CHEQUE).");
        }
        return documentRepository.findByDossierIdAndType(dossierId, normalizedType)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Document indisponible (non conservé ou dossier déjà clôturé)."));
    }

    @Transactional
    public Map<String, Object> updateStatus(Long id, String status, String defaultMotif, String motif, boolean motifRequired, String actorRole, Long actorUserId) {
        ChequeDossier dossier = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier introuvable"));

        if (motifRequired && (motif == null || motif.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le motif de rejet est obligatoire");
        }

        dossier.setStatut(status);
        dossier.setMotif((motif == null || motif.isBlank()) ? defaultMotif : motif);
        KycUser actor = actorUserId == null ? null : resolveUser(actorUserId, null);
        String normalizedRole = actor == null ? normalizeRole(actorRole) : actor.getType();
        if ("ESCALATED".equals(status)) {
            dossier.setEscalatedByRole(normalizedRole);
            if (actor != null) {
                dossier.setEscalatedByUserId(actor.getId());
                dossier.setEscalatedByUserName(fullName(actor));
            }
        }
        if ("APPROVED".equals(status) || "REJECTED".equals(status)) {
            dossier.setHandledByRole(normalizedRole);
            if (actor != null) {
                dossier.setHandledByUserId(actor.getId());
                dossier.setHandledByUserName(fullName(actor));
            }
            if ("BACK_OFFICE".equals(normalizedRole)) {
                dossier.setDecisionBackOffice(status);
                dossier.setMotifBackOffice((motif == null || motif.isBlank()) ? defaultMotif : motif);
                dossier.setDecidedBackOfficeAt(LocalDateTime.now());
            }
        }
        repository.save(dossier);

        // Rétention : purge de l'image dès qu'une décision finale est rendue.
        if ("APPROVED".equals(status) || "REJECTED".equals(status)) {
            documentRepository.deleteAllByDossierId(id);
        }

        String message = switch (status) {
            case "APPROVED" -> "Chèque approuvé";
            case "REJECTED" -> "Chèque rejeté";
            case "ESCALATED" -> "Chèque escaladé";
            default -> "Dossier mis à jour";
        };

        return Map.of("message", message, "statut", status, "id", id);
    }

    /**
     * Enregistre les corrections d'extraction faites par le Back Office sur un chèque.
     * Une ligne {@link ExtractionCorrection} (document CHEQUE) avec copie de l'image.
     */
    @Transactional
    public Map<String, Object> saveCorrection(Long dossierId,
                                              Map<String, Map<String, Object>> documents,
                                              Map<String, Object> boxes,
                                              Long actorUserId) {
        Map<String, Map<String, Object>> docs = normalizeKeys(documents);
        Map<String, Object> boxMap = normalizeKeys(boxes);
        if (docs.isEmpty() && boxMap.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucune correction fournie.");
        }
        ChequeDossier dossier = repository.findById(dossierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier introuvable"));
        KycUser actor = resolveUser(actorUserId, null);
        JsonNode analysis = readJsonQuietly(dossier.getAnalysisJson());

        java.util.Set<String> types = new java.util.LinkedHashSet<>();
        types.addAll(docs.keySet());
        types.addAll(boxMap.keySet());

        int saved = 0;
        for (String type : types) {
            Map<String, Object> corrected = docs.get(type);
            Object boxObj = boxMap.get(type);
            boolean hasText = corrected != null && !corrected.isEmpty();
            boolean hasBoxes = boxObj instanceof Map && !((Map<?, ?>) boxObj).isEmpty();
            if (!hasText && !hasBoxes) {
                continue;
            }

            JsonNode originalNode = analysis == null ? null : analysis.path("extracted");

            ExtractionCorrection correction = new ExtractionCorrection();
            correction.setDomain(ExtractionCorrection.DOMAIN_CHEQUE);
            correction.setDossierId(dossierId);
            correction.setDocumentType(type);
            documentRepository.findByDossierIdAndType(dossierId, type).ifPresent(doc -> {
                correction.setImageData(doc.getData());
                correction.setContentType(doc.getContentType());
                correction.setFilename(doc.getFilename());
            });
            correction.setOriginalJson(originalNode == null || originalNode.isMissingNode() ? null : originalNode.toString());
            correction.setCorrectedJson(hasText ? writeJsonQuietly(corrected) : null);
            correction.setBoxesJson(hasBoxes ? writeJsonQuietly(boxObj) : null);
            correction.setCorrectedByUserId(actor.getId());
            correction.setCorrectedByUserName(fullName(actor));
            correctionRepository.save(correction);
            saved++;
        }

        return Map.of("message", "Corrections enregistrées", "count", saved, "id", dossierId);
    }

    /** Recopie une map en mettant les clés (types de document) en MAJUSCULES. */
    private <V> Map<String, V> normalizeKeys(Map<String, V> map) {
        Map<String, V> out = new LinkedHashMap<>();
        if (map != null) {
            for (Map.Entry<String, V> e : map.entrySet()) {
                if (e.getKey() != null) {
                    out.put(e.getKey().trim().toUpperCase(), e.getValue());
                }
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboardStats(int range) {
        int days = Math.max(7, Math.min(range, 30));
        List<ChequeDossier> dossiers = repository.findAllByOrderByCreatedAtDesc();

        long approved = dossiers.stream().filter(d -> "APPROVED".equals(d.getStatut())).count();
        long rejected = dossiers.stream().filter(d -> "REJECTED".equals(d.getStatut())).count();
        long escalated = dossiers.stream().filter(d -> "ESCALATED".equals(d.getStatut())).count();
        long pending = dossiers.stream().filter(d -> "PENDING".equals(d.getStatut())).count();
        long processed = approved + rejected;
        long highRisk = dossiers.stream().filter(d -> d.getRiskScore() != null && d.getRiskScore() >= 70).count();
        long alerts = escalated + highRisk;
        long approvalRate = processed == 0 ? 0 : Math.round((approved * 100.0) / processed);

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> series = java.util.stream.IntStream.range(0, days)
                .mapToObj(i -> {
                    LocalDate day = today.minusDays(days - 1L - i);
                    long count = dossiers.stream()
                            .filter(d -> d.getCreatedAt() != null)
                            .filter(d -> d.getCreatedAt().toLocalDate().equals(day))
                            .count();
                    return Map.<String, Object>of(
                            "label", day.getDayOfMonth() + "/" + day.getMonthValue(),
                            "value", count
                    );
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> recentActivity = dossiers.stream()
                .limit(8)
                .map(this::toActivityResponse)
                .collect(Collectors.toList());

        List<Map<String, Object>> latestDossiers = dossiers.stream()
                .limit(8)
                .map(this::toDossierResponse)
                .collect(Collectors.toList());

        List<Map<String, Object>> notifications = dossiers.stream()
                .filter(d -> "ESCALATED".equals(d.getStatut()))
                .limit(10)
                .map(this::toNotificationResponse)
                .collect(Collectors.toList());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", dossiers.size());
        stats.put("processed", processed);
        stats.put("pending", pending);
        stats.put("escalated", escalated);
        stats.put("approved", approved);
        stats.put("rejected", rejected);
        stats.put("approvalRate", approvalRate);
        stats.put("alerts", alerts);
        stats.put("series", series);
        stats.put("recentActivity", recentActivity);
        stats.put("latestDossiers", latestDossiers);
        stats.put("notifications", notifications);
        return stats;
    }

    private Map<String, Object> toDossierResponse(ChequeDossier dossier) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", dossier.getId());
        response.put("filename", dossier.getFilename());
        response.put("montant_chiffre", dossier.getMontantChiffre());
        response.put("montant_lettre", dossier.getMontantLettre());
        response.put("beneficiaire", dossier.getBeneficiaire());
        response.put("num_compte", dossier.getNumCompte());
        response.put("cmc7", dossier.getCmc7());
        response.put("signature_present", dossier.getSignaturePresent());
        response.put("decision_ia", dossier.getDecisionIa());
        response.put("decision_back_office", dossier.getDecisionBackOffice());
        response.put("motif_back_office", dossier.getMotifBackOffice());
        response.put("decided_back_office_at", dossier.getDecidedBackOfficeAt());
        response.put("statut", dossier.getStatut());
        response.put("motif", dossier.getMotif());
        response.put("agent_report", dossier.getAgentReport());
        response.put("risk_score", dossier.getRiskScore());
        response.put("analysis", readJsonQuietly(dossier.getAnalysisJson()));
        response.put("has_documents", documentRepository.existsByDossierId(dossier.getId()));
        response.put("created_by_role", dossier.getCreatedByRole());
        response.put("created_by_user_id", dossier.getCreatedByUserId());
        response.put("created_by_user_name", dossier.getCreatedByUserName());
        response.put("escalated_by_role", dossier.getEscalatedByRole());
        response.put("escalated_by_user_id", dossier.getEscalatedByUserId());
        response.put("escalated_by_user_name", dossier.getEscalatedByUserName());
        response.put("handled_by_role", dossier.getHandledByRole());
        response.put("handled_by_user_id", dossier.getHandledByUserId());
        response.put("handled_by_user_name", dossier.getHandledByUserName());
        response.put("created_at", dossier.getCreatedAt());
        response.put("updated_at", dossier.getUpdatedAt());
        return response;
    }

    private Map<String, Object> toActivityResponse(ChequeDossier dossier) {
        String statut = dossier.getStatut();
        String kind = switch (statut) {
            case "APPROVED" -> "success";
            case "REJECTED" -> "danger";
            case "ESCALATED" -> "warning";
            default -> "info";
        };
        String action = switch (statut) {
            case "APPROVED" -> "approuvé";
            case "REJECTED" -> "rejeté";
            case "ESCALATED" -> "escaladé";
            default -> "reçu";
        };
        return Map.of(
                "id", dossier.getId(),
                "kind", kind,
                "title", "Chèque #" + dossier.getId() + " " + action,
                "agent", dossier.getHandledByUserName() != null ? dossier.getHandledByUserName() : fallback(dossier.getCreatedByUserName(), "Agent Chèque"),
                "created_at", fallbackDate(dossier.getUpdatedAt(), dossier.getCreatedAt())
        );
    }

    private Map<String, Object> toNotificationResponse(ChequeDossier dossier) {
        return Map.of(
                "id", dossier.getId(),
                "title", "Chèque #" + dossier.getId() + " escaladé au Back Office",
                "client", fallback(dossier.getBeneficiaire(), ""),
                "created_at", fallbackDate(dossier.getUpdatedAt(), dossier.getCreatedAt()),
                "motif", fallback(dossier.getMotif(), "Escaladé pour révision manuelle")
        );
    }

    private KycUser resolveUser(Long userId, String requiredType) {
        KycUser user;
        if (userId == null) {
            user = userRepository.findAllByOrderByIdAsc().stream()
                    .filter(u -> requiredType == null || requiredType.equals(u.getType()))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Utilisateur introuvable"));
        } else {
            user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Utilisateur introuvable"));
        }
        if (requiredType != null && !requiredType.equals(user.getType())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Utilisateur non autorisé pour cette action");
        }
        return user;
    }

    private String fullName(KycUser user) {
        return (fallback(user.getPrenom(), "") + " " + fallback(user.getNom(), "")).trim();
    }

    private boolean isFilled(String value) {
        return value != null && !value.isBlank();
    }

    private String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private LocalDateTime fallbackDate(LocalDateTime value, LocalDateTime fallback) {
        return value == null ? fallback : value;
    }

    private String normalizeRole(String actorRole) {
        if (actorRole == null || actorRole.isBlank()) {
            return "FRONT_OFFICE";
        }
        String role = actorRole.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if ("BACK_OFFICE".equals(role) || "FRONT_OFFICE".equals(role)) {
            return role;
        }
        return "FRONT_OFFICE";
    }

    private void validateUpload(MultipartFile upload, String label) {
        if (upload == null || upload.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " : fichier obligatoire.");
        }
        if (!ACCEPTED_TYPES.contains(upload.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " : format non supporté.");
        }
    }

    private String buildAgentReport(String decision, JsonNode validation, JsonNode errors, JsonNode manuscrit,
                                    boolean signaturePresent, boolean numCompteDetected, boolean cmc7Detected) {
        StringBuilder builder = new StringBuilder();
        builder.append("Décision finale : ").append(decision).append("\n\n");
        builder.append("Informations extraites :\n");
        builder.append("  - Montant (chiffres) : ").append(text(manuscrit.path("montant_chiffre"), "N/A")).append('\n');
        builder.append("  - Montant (lettres)  : ").append(text(manuscrit.path("montant_lettre"), "N/A")).append('\n');
        builder.append("  - Bénéficiaire       : ").append(text(manuscrit.path("beneficiaire"), "N/A")).append('\n');
        builder.append("  - N° de compte       : détecté: ").append(numCompteDetected ? "oui" : "non").append('\n');
        builder.append("  - Signature          : ").append(signaturePresent ? "présente" : "absente").append('\n');
        builder.append("  - Bande CMC7         : détectée: ").append(cmc7Detected ? "oui" : "non").append("\n\n");

        boolean valide = "VALIDE".equals(stripAccents(decision));
        String message = text(validation.path("message"), "");
        if (message.isBlank() && errors != null && errors.isArray()) {
            message = String.join("; ", streamErrors(errors));
        }
        builder.append("Motif : ").append(valide ? "Aucun" : (message.isBlank() ? "Vérification requise" : message)).append('\n');
        builder.append("Action requise : ").append(valide ? "AUCUNE" : "Vérification manuelle par l'opérateur.");
        return builder.toString();
    }

    private List<String> streamErrors(JsonNode errors) {
        java.util.List<String> out = new java.util.ArrayList<>();
        errors.forEach(e -> out.add(e.asText()));
        return out;
    }

    private Map<String, String> check(String label, String value, String status) {
        return Map.of("label", label, "value", value, "status", status);
    }

    private String cleanFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "upload";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String text(JsonNode node, String fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        return node.asText(fallback);
    }

    private String stripAccents(String value) {
        return value == null ? "" : java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toUpperCase();
    }

    private void saveDocument(Long dossierId, String type, MultipartFile upload) throws IOException {
        ChequeDocument document = new ChequeDocument();
        document.setDossierId(dossierId);
        document.setType(type);
        document.setContentType(upload.getContentType());
        document.setFilename(cleanFilename(upload.getOriginalFilename()));
        document.setData(upload.getBytes());
        documentRepository.save(document);
    }

    private String writeJsonQuietly(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    private JsonNode readJsonQuietly(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }
}
