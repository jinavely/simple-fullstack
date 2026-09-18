package jinavely.github.io.fullstack.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())              // API 테스트 편하게
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()              // 모든 요청 허용 (임시)
                );
        return http.build();
    }
}