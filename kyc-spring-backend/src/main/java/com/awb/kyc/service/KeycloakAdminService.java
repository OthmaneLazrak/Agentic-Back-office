package com.awb.kyc.service;

import com.awb.kyc.dto.KeycloakUserDto;
import jakarta.ws.rs.core.Response;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class KeycloakAdminService {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "FRONT_OFFICE", "BACK_OFFICE");

    private final Keycloak keycloak;
    private final String realm;

    public KeycloakAdminService(Keycloak keycloak, @Value("${keycloak.realm}") String realm) {
        this.keycloak = keycloak;
        this.realm = realm;
    }

    public List<KeycloakUserDto> listUsers() {
        UsersResource users = realm().users();
        return users.list(0, 200).stream()
                .map(rep -> toDto(rep, fetchUserRoles(rep.getId())))
                .collect(Collectors.toList());
    }

    public KeycloakUserDto getUser(String id) {
        UserRepresentation rep = realm().users().get(id).toRepresentation();
        return toDto(rep, fetchUserRoles(id));
    }

    public KeycloakUserDto createUser(KeycloakUserDto dto) {
        validateRoles(dto.getRoles());
        if (dto.getUsername() == null || dto.getUsername().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom d'utilisateur est obligatoire");
        }
        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le mot de passe initial est obligatoire");
        }

        UserRepresentation user = new UserRepresentation();
        user.setUsername(dto.getUsername());
        user.setEmail(dto.getEmail());
        user.setFirstName(dto.getFirstName());
        user.setLastName(dto.getLastName());
        user.setEnabled(dto.getEnabled() == null ? Boolean.TRUE : dto.getEnabled());
        user.setEmailVerified(true);

        UsersResource users = realm().users();
        String newId;
        try (Response response = users.create(user)) {
            if (response.getStatus() == HttpStatus.CONFLICT.value()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Un utilisateur avec ce nom ou email existe déjà");
            }
            if (response.getStatus() >= 400) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Création échouée : " + response.getStatusInfo().getReasonPhrase());
            }
            newId = extractIdFromLocation(response);
        }

        UserResource userRes = users.get(newId);
        setPassword(userRes, dto.getPassword(), false);
        assignRealmRoles(userRes, dto.getRoles());

        return toDto(userRes.toRepresentation(), fetchUserRoles(newId));
    }

    public KeycloakUserDto updateUser(String id, KeycloakUserDto dto) {
        validateRoles(dto.getRoles());
        UserResource userRes = realm().users().get(id);
        UserRepresentation rep = userRes.toRepresentation();
        if (dto.getEmail() != null) rep.setEmail(dto.getEmail());
        if (dto.getFirstName() != null) rep.setFirstName(dto.getFirstName());
        if (dto.getLastName() != null) rep.setLastName(dto.getLastName());
        if (dto.getEnabled() != null) rep.setEnabled(dto.getEnabled());
        userRes.update(rep);

        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            setPassword(userRes, dto.getPassword(), false);
        }
        if (dto.getRoles() != null) {
            replaceRealmRoles(userRes, dto.getRoles());
        }
        return toDto(userRes.toRepresentation(), fetchUserRoles(id));
    }

    public void deleteUser(String id) {
        try (Response response = realm().users().delete(id)) {
            if (response.getStatus() >= 400) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Suppression échouée");
            }
        }
    }

    public void resetPassword(String id, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nouveau mot de passe est obligatoire");
        }
        setPassword(realm().users().get(id), newPassword, false);
    }

    private RealmResource realm() {
        return keycloak.realm(realm);
    }

    private void validateRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return;
        }
        for (String role : roles) {
            if (!ALLOWED_ROLES.contains(role)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle non autorisé : " + role);
            }
        }
    }

    private void setPassword(UserResource userRes, String password, boolean temporary) {
        CredentialRepresentation cred = new CredentialRepresentation();
        cred.setType(CredentialRepresentation.PASSWORD);
        cred.setValue(password);
        cred.setTemporary(temporary);
        userRes.resetPassword(cred);
    }

    private void assignRealmRoles(UserResource userRes, List<String> roleNames) {
        if (roleNames == null || roleNames.isEmpty()) return;
        List<RoleRepresentation> roles = roleNames.stream()
                .map(name -> realm().roles().get(name).toRepresentation())
                .collect(Collectors.toList());
        userRes.roles().realmLevel().add(roles);
    }

    private void replaceRealmRoles(UserResource userRes, List<String> roleNames) {
        List<RoleRepresentation> current = userRes.roles().realmLevel().listAll().stream()
                .filter(r -> ALLOWED_ROLES.contains(r.getName()))
                .collect(Collectors.toList());
        if (!current.isEmpty()) {
            userRes.roles().realmLevel().remove(current);
        }
        assignRealmRoles(userRes, roleNames);
    }

    private List<String> fetchUserRoles(String userId) {
        try {
            return realm().users().get(userId).roles().realmLevel().listEffective().stream()
                    .map(RoleRepresentation::getName)
                    .filter(ALLOWED_ROLES::contains)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private KeycloakUserDto toDto(UserRepresentation rep, List<String> roles) {
        KeycloakUserDto dto = new KeycloakUserDto();
        dto.setId(rep.getId());
        dto.setUsername(rep.getUsername());
        dto.setEmail(rep.getEmail());
        dto.setFirstName(rep.getFirstName());
        dto.setLastName(rep.getLastName());
        dto.setEnabled(rep.isEnabled());
        dto.setRoles(roles == null ? new ArrayList<>() : roles);
        return dto;
    }

    private String extractIdFromLocation(Response response) {
        String location = response.getLocation() == null ? null : response.getLocation().getPath();
        if (location == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible de déterminer l'id de l'utilisateur créé");
        }
        return location.substring(location.lastIndexOf('/') + 1);
    }
}
