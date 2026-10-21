package com.webtoonbadge.common;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.webtoonbadge.config.AppProperties;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * IP별로 1분 동안 보낼 수 있는 요청 수를 제한한다(고정 윈도우 방식).
 * 이 서비스가 네이버에 과도한 요청을 보내는 통로가 되지 않도록 막는 장치.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final Cache<String, AtomicInteger> counters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(100_000)
            .build();
    private final int badgesPerMinute;
    private final int imagesPerMinute;

    public RateLimitFilter(AppProperties props) {
        this.badgesPerMinute = props.rateLimit().badgesPerMinute();
        this.imagesPerMinute = props.rateLimit().imagesPerMinute();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean image = path.startsWith("/api/image");
        int limit = image ? imagesPerMinute : badgesPerMinute;
        String key = (image ? "img:" : "api:") + request.getRemoteAddr();

        int count = counters.get(key, k -> new AtomicInteger()).incrementAndGet();
        if (count > limit) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"code\":\"TOO_MANY_REQUESTS\",\"message\":\"요청이 너무 많아요. 1분 뒤에 다시 시도해 주세요.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
