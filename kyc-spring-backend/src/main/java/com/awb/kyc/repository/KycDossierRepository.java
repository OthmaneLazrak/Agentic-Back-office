package com.awb.kyc.repository;

import com.awb.kyc.entity.KycDossier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KycDossierRepository extends JpaRepository<KycDossier, Long> {
    List<KycDossier> findByStatutOrderByCreatedAtDesc(String statut);

    List<KycDossier> findAllByOrderByCreatedAtDesc();
}
