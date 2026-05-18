package com.awb.kyc.config;

import com.awb.kyc.entity.KycUser;
import com.awb.kyc.repository.KycUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner seedUsers(KycUserRepository users) {
        return args -> {
            if (users.count() > 0) {
                return;
            }

            KycUser front = new KycUser();
            front.setNom("Lazrek");
            front.setPrenom("Othmane");
            front.setType("FRONT_OFFICE");
            users.save(front);

            KycUser back = new KycUser();
            back.setNom("Bennani");
            back.setPrenom("Imane");
            back.setType("BACK_OFFICE");
            users.save(back);
        };
    }
}
