package com.webtoonbadge.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Cors cors,
        Naver naver,
        Cache cache,
        RateLimit rateLimit,
        ImageProxy imageProxy
) {

    public record Cors(List<String> allowedOrigins) {
    }

    public record Naver(
            String baseUrl,
            String userAgent,
            Duration connectTimeout,
            Duration readTimeout,
            int pageSize,
            int maxPages,
            Duration pageDelay
    ) {
    }

    public record Cache(Duration ttl, long maxSize) {
    }

    public record RateLimit(int badgesPerMinute, int imagesPerMinute) {
    }

    public record ImageProxy(List<String> allowedDomains, long maxBytes) {
    }
}
