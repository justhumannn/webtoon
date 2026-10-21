package com.webtoonbadge.badge;

import java.time.Instant;
import java.util.List;

public record BadgeListResponse(
        Profile profile,
        int totalCount,
        int hiddenAdultCount,
        List<Badge> badges,
        Instant fetchedAt
) {

    public record Profile(String handle, String nickname, String profileImageUrl, String pageUrl) {
    }

    /**
     * @param imageUrl     이 서버의 이미지 프록시 경로 (브라우저에서 이미지로 저장할 때 CORS 문제를 피하려고 사용)
     * @param sourceImageUrl 네이버 원본 썸네일 주소
     */
    public record Badge(
            long titleId,
            String subject,
            String imageUrl,
            String sourceImageUrl,
            String bannerColor,
            double score,
            boolean adult,
            String titleUrl
    ) {
    }
}
