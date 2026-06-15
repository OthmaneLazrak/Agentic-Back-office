package com.awb.kyc.service;

import com.awb.kyc.entity.ExtractionCorrection;
import com.awb.kyc.entity.KycDocument;
import com.awb.kyc.entity.KycDossier;
import com.awb.kyc.entity.KycUser;
import com.awb.kyc.repository.ExtractionCorrectionRepository;
import com.awb.kyc.repository.KycDocumentRepository;
import com.awb.kyc.repository.KycDossierRepository;
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

@Service
public class KycService {

    private static final List<String> ACCEPTED_TYPES = List.of("image/jpeg", "image/png", "image/jpg");

    private final KycDossierRepository repository;
    private final KycUserRepository userRepository;
    private final KycDocumentRepository documentRepository;
    private final ExtractionCorrectionRepository correctionRepository;
    private final AiOrchestratorService aiOrchestrator;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;

    public KycService(
            KycDossierRepository repository,
            KycUserRepository userRepository,
            KycDocumentRepository documentRepository,
            ExtractionCorrectionRepository correctionRepository,
            AiOrchestratorService aiOrchestrator,
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
    public Map<String, Object> analyze(MultipartFile file, MultipartFile justif, Long actorUserId) {
        validateUpload(file, "CIN");
        validateUpload(justif, "Justificatif");
        KycUser actor = resolveUser(actorUserId, "FRONT_OFFICE");

        Path cinPath = null;
        Path justifPath = null;
        try {
            Files.createDirectories(uploadDir);
            cinPath = uploadDir.resolve("cin_" + UUID.randomUUID() + "_" + cleanFilename(file.getOriginalFilename()));
            justifPath = uploadDir.resolve("justif_" + UUID.randomUUID() + "_" + cleanFilename(justif.getOriginalFilename()));

            Files.copy(file.getInputStream(), cinPath, StandardCopyOption.REPLACE_EXISTING);
            Files.copy(justif.getInputStream(), justifPath, StandardCopyOption.REPLACE_EXISTING);

            JsonNode result = aiOrchestrator.analyze(cinPath, justifPath);
            String decision = text(result.at("/validation/statut"), "INCONNU");
            JsonNode errorsNode = result.at("/validation/erreurs");
            JsonNode details = result.at("/validation/details");
            JsonNode donneesCin = result.path("donnees_cin");
            JsonNode donneesJustif = result.path("donnees_justif");
            JsonNode validationCin = result.path("validation_cin");
            JsonNode validationJustif = result.path("validation_justif");

            JsonNode dpCin = details.path("cin");
            JsonNode dpJustif = details.path("justificatif");
            Integer age = dpCin.path("age_calcule").isNumber() ? dpCin.path("age_calcule").asInt() : null;

            String agentTextFromLlm = text(result.path("agent_text"), "");
            String agentReport = agentTextFromLlm.isBlank()
                    ? buildAgentReport(decision, result.path("validation"), errorsNode, dpCin, dpJustif)
                    : agentTextFromLlm;
            boolean cinOk = "APPROUVE".equals(stripAccents(text(validationCin.path("statut"), "")));
            boolean justifOk = "APPROUVE".equals(stripAccents(text(validationJustif.path("statut"), "")));
            boolean namesOk = "APPROUVE".equals(stripAccents(decision));
            int riskScore = namesOk ? 30 : 68;
            String riskLevel = riskScore < 40 ? "low" : riskScore < 70 ? "medium" : "high";

            Map<String, Object> extracted = new LinkedHashMap<>();
            extracted.put("nom", text(donneesCin.path("nom"), ""));
            extracted.put("prenom", text(donneesCin.path("prenom"), ""));
            extracted.put("numero_cin", text(donneesCin.path("numero_cin"), ""));
            extracted.put("date_naissance", text(donneesCin.path("date_naissance"), ""));
            extracted.put("date_expiration", text(donneesCin.path("date_expiration"), ""));
            extracted.put("age", age);

            Map<String, Object> extractedJustif = new LinkedHashMap<>();
            extractedJustif.put("nom", text(donneesJustif.path("nom"), ""));
            extractedJustif.put("adresse", text(donneesJustif.path("adresse"), ""));
            extractedJustif.put("sous_type", text(donneesJustif.path("sous_type"), ""));

            Map<String, Object> checks = new LinkedHashMap<>();
            checks.put("document_authenticity", check("Authenticité Document", cinOk ? "Vérifié" : "Invalide", cinOk ? "success" : "error"));
            checks.put("fields_complete", check("Complétude des champs", cinOk ? "OK" : "Incomplet", cinOk ? "success" : "error"));
            checks.put("majority_check", check("Majorité (18 ans+)", cinOk ? "OK" : "À vérifier", cinOk ? "success" : "warning"));
            checks.put("nom_match", check("Correspondance Noms", namesOk ? "Concordants" : "Discordants", namesOk ? "success" : "error"));

            // Snapshot complet de l'analyse front-office, resservi tel quel au Back Office à l'escalade.
            Map<String, Object> analysis = new LinkedHashMap<>();
            analysis.put("decision", decision);
            analysis.put("risk_score", riskScore);
            analysis.put("risk_level", riskLevel);
            analysis.put("extracted", extracted);
            analysis.put("extracted_justif", extractedJustif);
            analysis.put("checks", checks);
            analysis.put("errors", errorsNode.isArray() ? errorsNode : List.of());

            // Boîtes YOLO (+ taille image) par document -> permettent au Back Office
            // d'afficher/corriger la détection. CIN uniquement (le justificatif est VLM).
            Map<String, Object> boxes = new LinkedHashMap<>();
            if (donneesCin.path("_boxes").isObject()) {
                boxes.put(KycDocument.TYPE_CIN, donneesCin.path("_boxes"));
            }
            analysis.put("boxes", boxes);
            Map<String, Object> imageSizes = new LinkedHashMap<>();
            if (donneesCin.path("_image_size").isArray()) {
                imageSizes.put(KycDocument.TYPE_CIN, donneesCin.path("_image_size"));
            }
            analysis.put("image_sizes", imageSizes);

            KycDossier dossier = new KycDossier();
            dossier.setFilename(file.getOriginalFilename());
            dossier.setNom(text(donneesCin.path("nom"), ""));
            dossier.setPrenom(text(donneesCin.path("prenom"), ""));
            dossier.setCin(text(donneesCin.path("numero_cin"), ""));
            dossier.setDecisionIa(decision);
            dossier.setStatut("PENDING");
            dossier.setAgentReport(agentReport);
            dossier.setRiskScore(riskScore);
            dossier.setAnalysisJson(writeJsonQuietly(analysis));
            dossier.setCreatedByRole(actor.getType());
            dossier.setCreatedByUserId(actor.getId());
            dossier.setCreatedByUserName(fullName(actor));
            repository.saveAndFlush(dossier);

            // Conserver les deux images en base pour la vérification manuelle Back Office.
            // Octets lus directement depuis l'upload (indépendant des fichiers temporaires).
            saveDocument(dossier.getId(), KycDocument.TYPE_CIN, file);
            saveDocument(dossier.getId(), KycDocument.TYPE_JUSTIF, justif);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "success");
            response.put("decision", decision);
            response.put("risk_score", riskScore);
            response.put("risk_level", riskLevel);
            response.put("extracted", extracted);
            response.put("extracted_justif", extractedJustif);
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
            deleteQuietly(cinPath);
            deleteQuietly(justifPath);
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listUsers() {
        return userRepository.findAllByOrderByIdAsc().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listDossiers(String statut) {
        List<KycDossier> dossiers = (statut == null || statut.isBlank())
                ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findByStatutOrderByCreatedAtDesc(statut.toUpperCase());

        return dossiers.stream()
                .map(this::toDossierResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public KycDocument getDocument(Long dossierId, String type) {
        String normalizedType = type == null ? "" : type.trim().toUpperCase();
        if (!KycDocument.TYPE_CIN.equals(normalizedType) && !KycDocument.TYPE_JUSTIF.equals(normalizedType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type de document invalide (CIN ou JUSTIF).");
        }
        return documentRepository.findByDossierIdAndType(dossierId, normalizedType)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Document indisponible (non conservé ou dossier déjà clôturé)."));
    }

    @Transactional
    public Map<String, Object> updateStatus(Long id, String status, String defaultMotif, String motif, boolean motifRequired, String actorRole, Long actorUserId) {
        KycDossier dossier = repository.findById(id)
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

        // Rétention : purge des images dès qu'une décision finale est rendue (front ou back).
        if ("APPROVED".equals(status) || "REJECTED".equals(status)) {
            documentRepository.deleteAllByDossierId(id);
        }

        String message = switch (status) {
            case "APPROVED" -> "Dossier approuvé";
            case "REJECTED" -> "Dossier rejeté";
            case "ESCALATED" -> "Dossier escaladé";
            default -> "Dossier mis à jour";
        };

        return Map.of("message", message, "statut", status, "id", id);
    }

    /**
     * Enregistre les corrections d'extraction faites par le Back Office.
     * Une ligne {@link ExtractionCorrection} par document corrigé (CIN / JUSTIF),
     * avec une copie de l'image (vérité terrain pour le réentraînement).
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
        KycDossier dossier = repository.findById(dossierId)
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

            JsonNode originalNode = analysis == null ? null
                    : (KycDocument.TYPE_JUSTIF.equals(type) ? analysis.path("extracted_justif") : analysis.path("extracted"));

            ExtractionCorrection correction = new ExtractionCorrection();
            correction.setDomain(ExtractionCorrection.DOMAIN_KYC);
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
        List<KycDossier> dossiers = repository.findAllByOrderByCreatedAtDesc();

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

    private Map<String, Object> toDossierResponse(KycDossier dossier) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", dossier.getId());
        response.put("filename", dossier.getFilename());
        response.put("nom", dossier.getNom());
        response.put("prenom", dossier.getPrenom());
        response.put("cin", dossier.getCin());
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

    private Map<String, Object> toUserResponse(KycUser user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", user.getId());
        response.put("nom", user.getNom());
        response.put("prenom", user.getPrenom());
        response.put("type", user.getType());
        response.put("fullName", fullName(user));
        return response;
    }

    private Map<String, Object> toActivityResponse(KycDossier dossier) {
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
                "title", "Dossier #" + dossier.getId() + " " + action,
                "agent", dossier.getHandledByUserName() != null ? dossier.getHandledByUserName() : fallback(dossier.getCreatedByUserName(), "Agent KYC"),
                "created_at", fallbackDate(dossier.getUpdatedAt(), dossier.getCreatedAt())
        );
    }

    private Map<String, Object> toNotificationResponse(KycDossier dossier) {
        return Map.of(
                "id", dossier.getId(),
                "title", "Dossier #" + dossier.getId() + " escaladé au Back Office",
                "client", (fallback(dossier.getNom(), "") + " " + fallback(dossier.getPrenom(), "")).trim(),
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

    private String buildAgentReport(String decision, JsonNode validation, JsonNode errors, JsonNode dpCin, JsonNode dpJustif) {
        if ("APPROUVE".equals(stripAccents(decision))) {
            return """
                    Décision finale : APPROUVÉ

                    CIN :
                      • Nom            : %s
                      • Prénom         : %s
                      • N° CIN         : %s
                      • Date naissance : %s

                    Justificatif :
                      • Nom      : %s
                      • Adresse  : %s

                    Motif : %s
                    Action requise : AUCUNE""".formatted(
                    text(dpCin.path("nom"), "N/A"),
                    text(dpCin.path("prenom"), "N/A"),
                    text(dpCin.path("numero_cin"), "N/A"),
                    text(dpCin.path("date_naissance"), "N/A"),
                    text(dpJustif.path("nom"), "N/A"),
                    text(dpJustif.path("adresse"), "N/A"),
                    text(validation.path("message"), "Aucun")
            );
        }

        StringBuilder builder = new StringBuilder("Décision finale : REJETÉ\n\nMotifs :\n");
        if (errors != null && errors.isArray()) {
            errors.forEach(error -> builder.append("  • ").append(error.asText()).append('\n'));
        }
        builder.append("\nAction requise : Vérification manuelle requise par l'opérateur.");
        return builder.toString();
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
                .replaceAll("\\p{M}", "");
    }

    private void saveDocument(Long dossierId, String type, MultipartFile upload) throws IOException {
        KycDocument document = new KycDocument();
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
