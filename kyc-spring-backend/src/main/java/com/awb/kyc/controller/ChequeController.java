package com.awb.kyc.controller;

import com.awb.kyc.dto.CorrectionRequest;
import com.awb.kyc.dto.DecisionRequest;
import com.awb.kyc.entity.ChequeDocument;
import com.awb.kyc.entity.KycUser;
import com.awb.kyc.service.AuthenticatedUserService;
import com.awb.kyc.service.ChequeService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

/**
 * Endpoints d'analyse et de décision des chèques (équivalent {@link KycController}).
 * Mono-document : un seul fichier {@code file} (le chèque) à l'analyse.
 */
@RestController
public class ChequeController {

    private final ChequeService chequeService;
    private final AuthenticatedUserService authenticatedUserService;

    public ChequeController(ChequeService chequeService, AuthenticatedUserService authenticatedUserService) {
        this.chequeService = chequeService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping(value = "/cheque/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('FRONT_OFFICE')")
    public Map<String, Object> analyzeCheque(@RequestPart("file") MultipartFile file) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        return chequeService.analyze(file, actor.getId());
    }

    @GetMapping("/cheque/dossiers")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public List<Map<String, Object>> listDossiers(@RequestParam(required = false) String statut) {
        return chequeService.listDossiers(statut);
    }

    @GetMapping("/cheque/dossiers/{id}/documents/{type}")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public ResponseEntity<byte[]> getDocument(@PathVariable Long id, @PathVariable String type) {
        ChequeDocument document = chequeService.getDocument(id, type);
        MediaType mediaType = document.getContentType() != null
                ? MediaType.parseMediaType(document.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .cacheControl(CacheControl.noCache())
                .body(document.getData());
    }

    @GetMapping("/cheque/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN','FRONT_OFFICE','BACK_OFFICE')")
    public Map<String, Object> dashboard(@RequestParam(defaultValue = "14") int range) {
        return chequeService.dashboardStats(range);
    }

    @PatchMapping("/cheque/dossiers/{id}/approuver")
    @PreAuthorize("hasRole('BACK_OFFICE')")
    public Map<String, Object> approuver(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return chequeService.updateStatus(id, "APPROVED", "Approuvé manuellement par l'opérateur", motif, false, actor.getType(), actor.getId());
    }

    @PatchMapping("/cheque/dossiers/{id}/rejeter")
    @PreAuthorize("hasAnyRole('FRONT_OFFICE','BACK_OFFICE')")
    public Map<String, Object> rejeter(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return chequeService.updateStatus(id, "REJECTED", null, motif, true, actor.getType(), actor.getId());
    }

    @PatchMapping("/cheque/dossiers/{id}/escalader")
    @PreAuthorize("hasRole('FRONT_OFFICE')")
    public Map<String, Object> escalader(@PathVariable Long id, @RequestBody(required = false) DecisionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        String motif = body == null ? null : body.getMotif();
        return chequeService.updateStatus(id, "ESCALATED", "Escaladé pour révision manuelle", motif, false, actor.getType(), actor.getId());
    }

    @PostMapping("/cheque/dossiers/{id}/corrections")
    @PreAuthorize("hasRole('BACK_OFFICE')")
    public Map<String, Object> corriger(@PathVariable Long id, @RequestBody CorrectionRequest body) {
        KycUser actor = authenticatedUserService.syncAndGetCurrentUser();
        return chequeService.saveCorrection(id,
                body == null ? null : body.getDocuments(),
                body == null ? null : body.getBoxes(),
                actor.getId());
    }
}
