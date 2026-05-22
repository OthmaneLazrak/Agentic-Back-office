package com.awb.kyc.controller;

import com.awb.kyc.entity.KycUser;
import com.awb.kyc.service.AuthenticatedUserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticatedUserService authenticatedUserService;

    public AuthController(AuthenticatedUserService authenticatedUserService) {
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        KycUser user = authenticatedUserService.syncAndGetCurrentUser();
        String fullName = ((user.getPrenom() == null ? "" : user.getPrenom()) + " "
                + (user.getNom() == null ? "" : user.getNom())).trim();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.getId());
        body.put("keycloakId", user.getKeycloakId());
        body.put("username", user.getUsername());
        body.put("email", user.getEmail());
        body.put("firstName", user.getPrenom());
        body.put("lastName", user.getNom());
        body.put("fullName", fullName.isBlank() ? user.getUsername() : fullName);
        body.put("role", user.getType());
        body.put("authorities", authenticatedUserService.currentAuthorities());
        return body;
    }
}
