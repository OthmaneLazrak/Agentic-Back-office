package com.awb.kyc.repository;

import com.awb.kyc.entity.ChequeDossier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChequeDossierRepository extends JpaRepository<ChequeDossier, Long> {
    List<ChequeDossier> findByStatutOrderByCreatedAtDesc(String statut);

    List<ChequeDossier> findAllByOrderByCreatedAtDesc();
}
