package com.awb.kyc.repository;

import com.awb.kyc.entity.ExtractionCorrection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExtractionCorrectionRepository extends JpaRepository<ExtractionCorrection, Long> {

    /** Corrections pas encore versées au dataset d'entraînement (pour l'export). */
    List<ExtractionCorrection> findByExportedAtIsNullOrderByCorrectedAtAsc();

    List<ExtractionCorrection> findByDomainOrderByCorrectedAtDesc(String domain);

    long countByDomain(String domain);
}
