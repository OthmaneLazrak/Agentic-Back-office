package com.awb.kyc.service;

import com.awb.kyc.entity.KycUser;
import com.awb.kyc.repository.KycUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@Service
public class AuthenticatedUserService {

    private static final List<String> BUSINESS_ROLES = List.of("ADMIN", "FRONT_OFFICE", "BACK_OFFICE");

    private final KycUserRepository userRepository;

    public AuthenticatedUserService(KycUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Jwt currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getToken();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise");
    }

    public Set<String> currentAuthorities() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return Set.of();
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toSet());
    }

    public String primaryBusinessRole() {
        Set<String> authorities = currentAuthorities();
        for (String role : BUSINESS_ROLES) {
            if (authorities.contains("ROLE_" + role)) {
                return role;
            }
        }
        return null;
    }

    @Transactional
    public KycUser syncAndGetCurrentUser() {
        Jwt jwt = currentJwt();
        String keycloakId = jwt.getSubject();
        String username = jwt.getClaimAsString("preferred_username");
        String email = jwt.getClaimAsString("email");
        String firstName = jwt.getClaimAsString("given_name");
        String lastName = jwt.getClaimAsString("family_name");
        String role = primaryBusinessRole();

        KycUser user = userRepository.findByKeycloakId(keycloakId).orElseGet(KycUser::new);
        user.setKeycloakId(keycloakId);
        user.setUsername(username);
        user.setEmail(email);
        user.setPrenom(firstName);
        user.setNom(lastName);
        if (role != null) {
            user.setType(role);
        } else if (user.getType() == null) {
            user.setType("FRONT_OFFICE");
        }
        return userRepository.save(user);
    }
}
