package com.awb.kyc.controller;

import com.awb.kyc.dto.DecisionRequest;
import com.awb.kyc.entity.KycUser;
import com.awb.kyc.service.AuthenticatedUserService;
import com.awb.kyc.service.KycService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
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
    private final AuthenticatedUserService authenticatedUserService;

    public KycController(KycService kycService, AuthenticatedUserService authenticatedUserService) {
        this.kycService = kycService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "AWB KYC API");
    }

    @PostMapping(value = "/kyc/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('FRONT_OFFICE')")
    public Map<String, Object> analyzeDocument(
            @RequestPart("file") MultipartFile file,
            @RequestPart("justif") MultipartFile justif
    ) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        return kycService.analyze(file, justif, actor.getId());
    }

    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public List<Map<String, Object>> listUsers() {
        return kycService.listUsers();
    }

    @GetMapping("/kyc/dossiers")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public List<Map<String, Object>> listDossiers(@RequestParam(required = false) String statut) {
        return kycService.listDossiers(statut);
    }

    @GetMapping("/kyc/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public Map<String, Object> dashboard(@RequestParam(defaultValue = "14") int range) {
        return kycService.dashboardStats(range);
    }

    @PatchMapping("/kyc/dossiers/{id}/approuver")
    @PreAuthorize("hasAnyRole('FRONT_OFFICE','BACK_OFFICE')")
    public Map<String, Object> approuver(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return kycService.updateStatus(id, "APPROVED", "Approuvé manuellement par l'opérateur", motif, false, actor.getType(), actor.getId());
    }

    @PatchMapping("/kyc/dossiers/{id}/rejeter")
    @PreAuthorize("hasAnyRole('FRONT_OFFICE','BACK_OFFICE')")
    public Map<String, Object> rejeter(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return kycService.updateStatus(id, "REJECTED", null, motif, true, actor.getType(), actor.getId());
    }

    @PatchMapping("/kyc/dossiers/{id}/escalader")
    @PreAuthorize("hasRole('FRONT_OFFICE')")
    public Map<String, Object> escalader(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return kycService.updateStatus(id, "ESCALATED", "Escaladé pour révision manuelle", motif, false, actor.getType(), actor.getId());
    }
}
