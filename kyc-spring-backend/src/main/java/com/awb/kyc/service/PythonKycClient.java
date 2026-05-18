package com.awb.kyc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Component
public class PythonKycClient {

    private final ObjectMapper objectMapper;
    private final String pythonExecutable;
    private final Path bridgePath;
    private final Duration timeout;

    public PythonKycClient(
            ObjectMapper objectMapper,
            @Value("${kyc.python-executable}") String pythonExecutable,
            @Value("${kyc.python-bridge}") String bridgePath,
            @Value("${kyc.python-timeout-seconds}") long timeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.pythonExecutable = pythonExecutable;
        this.bridgePath = resolveBridgePath(bridgePath);
        this.timeout = Duration.ofSeconds(timeoutSeconds);
    }

    public JsonNode analyze(Path cinPath, Path justificatifPath) {
        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonExecutable,
                bridgePath.toString(),
                cinPath.toAbsolutePath().toString(),
                justificatifPath.toAbsolutePath().toString()
        );
        processBuilder.redirectError(ProcessBuilder.Redirect.INHERIT);

        try {
            Process process = processBuilder.start();
            byte[] output = process.getInputStream().readAllBytes();
            boolean finished = process.waitFor(timeout.toSeconds(), TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("Timeout Python pendant l'analyse KYC.");
            }

            if (process.exitValue() != 0) {
                throw new IllegalStateException("Pipeline Python KYC en echec. Code: " + process.exitValue());
            }

            return objectMapper.readTree(new String(output, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'executer le bridge Python KYC.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Analyse KYC interrompue.", e);
        }
    }

    private Path resolveBridgePath(String configuredPath) {
        Path path = Path.of(configuredPath);
        if (path.isAbsolute() || Files.exists(path)) {
            return path.toAbsolutePath().normalize();
        }

        Path fromRepoRoot = Path.of("kyc-spring-backend").resolve(path);
        if (Files.exists(fromRepoRoot)) {
            return fromRepoRoot.toAbsolutePath().normalize();
        }

        return path.toAbsolutePath().normalize();
    }
}
