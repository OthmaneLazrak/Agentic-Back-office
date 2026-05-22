package com.awb.kyc.controller;

import com.awb.kyc.dto.KeycloakUserDto;
import com.awb.kyc.service.KeycloakAdminService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final KeycloakAdminService keycloakAdminService;

    public AdminUserController(KeycloakAdminService keycloakAdminService) {
        this.keycloakAdminService = keycloakAdminService;
    }

    @GetMapping
    public List<KeycloakUserDto> list() {
        return keycloakAdminService.listUsers();
    }

    @GetMapping("/{id}")
    public KeycloakUserDto get(@PathVariable String id) {
        return keycloakAdminService.getUser(id);
    }

    @PostMapping
    public KeycloakUserDto create(@RequestBody KeycloakUserDto dto) {
        return keycloakAdminService.createUser(dto);
    }

    @PutMapping("/{id}")
    public KeycloakUserDto update(@PathVariable String id, @RequestBody KeycloakUserDto dto) {
        return keycloakAdminService.updateUser(id, dto);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        keycloakAdminService.deleteUser(id);
        return Map.of("status", "deleted", "id", id);
    }

    @PostMapping("/{id}/reset-password")
    public Map<String, Object> resetPassword(@PathVariable String id, @RequestBody Map<String, String> body) {
        keycloakAdminService.resetPassword(id, body.get("password"));
        return Map.of("status", "ok", "id", id);
    }
}
