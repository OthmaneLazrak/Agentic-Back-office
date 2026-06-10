package com.awb.kyc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;
import java.time.Duration;

/**
 * AI Orchestrator dédié à l'analyse de chèques.
 *
 * Frontend → Spring Boot (ChequeService) → {@code ChequeAiOrchestratorService} → Python Agent Server (FastAPI)
 *                                                                                  → LangGraph Agent → MCP Tools / Models
 *
 * Mono-document : envoie un seul fichier (le chèque) à {@code /cheque/analyze}
 * et renvoie le payload structuré complet : donnees_manuscrit, donnees_zones,
 * validation, agent_text.
 */
@Service
public class ChequeAiOrchestratorService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public ChequeAiOrchestratorService(
            ObjectMapper objectMapper,
            @Value("${kyc.agent.base-url}") String baseUrl,
            @Value("${kyc.agent.timeout-seconds}") long timeoutSeconds
    ) {
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        Duration timeout = Duration.ofSeconds(timeoutSeconds);
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        requestFactory.setReadTimeout((int) timeout.toMillis());

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Appelle le Python Agent Server (FastAPI) avec l'image du chèque.
     * Renvoie le payload structuré complet : donnees_manuscrit, donnees_zones,
     * validation, agent_text.
     */
    public JsonNode analyze(Path chequePath) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(chequePath.toFile()));

        try {
            String json = restClient.post()
                    .uri("/cheque/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (json == null || json.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Réponse vide du Python Agent Server.");
            }
            return objectMapper.readTree(json);
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Python Agent Server a répondu en erreur (" + e.getStatusCode() + ") : "
                            + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Echec d'appel du Python Agent Server : " + e.getMessage(), e);
        }
    }
}
