package com.awb.kyc.controller;

import com.awb.kyc.dto.DecisionRequest;
import com.awb.kyc.service.KycService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
public class KycController {

    private final KycService kycService;

    public KycController(KycService kycService) {
        this.kycService = kycService;
    }

    @GetMapping("/")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "AWB KYC API");
    }

    @PostMapping(value = "/kyc/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> analyzeDocument(
            @RequestPart("file") MultipartFile file,
            @RequestPart("justif") MultipartFile justif,
            @RequestPart(value = "actorUserId", required = false) String actorUserId
    ) {
        return kycService.analyze(file, justif, parseLong(actorUserId));
    }

    @GetMapping("/users")
    public List<Map<String, Object>> listUsers() {
        return kycService.listUsers();
    }

    @GetMapping("/kyc/dossiers")
    public List<Map<String, Object>> listDossiers(@RequestParam(required = false) String statut) {
        return kycService.listDossiers(statut);
    }

    @GetMapping("/kyc/dashboard")
    public Map<String, Object> dashboard(@RequestParam(defaultValue = "14") int range) {
        return kycService.dashboardStats(range);
    }

    @PatchMapping("/kyc/dossiers/{id}/approuver")
    public Map<String, Object> approuver(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        String motif = body == null ? null : body.getMotif();
        String actorRole = body == null ? null : body.getActorRole();
        Long actorUserId = body == null ? null : body.getActorUserId();
        return kycService.updateStatus(id, "APPROVED", "Approuvé manuellement par l'opérateur", motif, false, actorRole, actorUserId);
    }

    @PatchMapping("/kyc/dossiers/{id}/rejeter")
    public Map<String, Object> rejeter(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        String motif = body == null ? null : body.getMotif();
        String actorRole = body == null ? null : body.getActorRole();
        Long actorUserId = body == null ? null : body.getActorUserId();
        return kycService.updateStatus(id, "REJECTED", null, motif, true, actorRole, actorUserId);
    }

    @PatchMapping("/kyc/dossiers/{id}/escalader")
    public Map<String, Object> escalader(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        String motif = body == null ? null : body.getMotif();
        String actorRole = body == null ? null : body.getActorRole();
        Long actorUserId = body == null ? null : body.getActorUserId();
        return kycService.updateStatus(id, "ESCALATED", "Escaladé pour révision manuelle", motif, false, actorRole, actorUserId);
    }

    private Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Long.parseLong(value);
    }
}
