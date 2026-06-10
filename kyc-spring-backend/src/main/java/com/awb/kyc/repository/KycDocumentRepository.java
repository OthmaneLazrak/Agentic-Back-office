package com.awb.kyc.repository;

import com.awb.kyc.entity.KycDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface KycDocumentRepository extends JpaRepository<KycDocument, Long> {

    Optional<KycDocument> findByDossierIdAndType(Long dossierId, String type);

    boolean existsByDossierId(Long dossierId);

    @Modifying
    @Query("delete from KycDocument d where d.dossierId = :dossierId")
    int deleteAllByDossierId(@Param("dossierId") Long dossierId);
}
