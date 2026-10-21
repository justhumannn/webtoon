package com.webtoonbadge.badge;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/badges")
public class BadgeController {

    private final BadgeService badgeService;

    public BadgeController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping
    public ResponseEntity<BadgeListResponse> getBadges(
            @RequestParam("url") String url,
            @RequestParam(value = "includeAdult", defaultValue = "false") boolean includeAdult
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(badgeService.getBadges(url, includeAdult));
    }
}
