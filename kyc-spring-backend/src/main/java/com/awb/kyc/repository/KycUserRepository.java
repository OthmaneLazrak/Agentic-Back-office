package com.awb.kyc.repository;

import com.awb.kyc.entity.KycUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KycUserRepository extends JpaRepository<KycUser, Long> {
    List<KycUser> findAllByOrderByIdAsc();
}
