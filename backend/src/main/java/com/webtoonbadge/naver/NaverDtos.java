package com.webtoonbadge.naver;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * 네이버웹툰 커뮤니티 API 응답 중 이 서비스가 쓰는 필드만 담는다.
 * 공식 공개 API가 아니므로 필드가 바뀔 수 있다는 점을 전제로, 모르는 필드는 무시한다.
 */
public final class NaverDtos {

    private NaverDtos() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope<T>(String status, T result, ApiError error) {
        public boolean isSuccess() {
            return "success".equals(status);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiError(String typeMessage, String code) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreatorResult(Creator creator, Settings settings) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Creator(String creatorId, String profileUrl, String nickname, ProfileImage profileImage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProfileImage(String domain, String shareDomain, String path) {
        public String toUrl() {
            String host = shareDomain != null && !shareDomain.isBlank() ? shareDomain : domain;
            if (host == null || host.isBlank() || path == null || path.isBlank()) {
                return null;
            }
            return host + path;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Settings(String fanScoreVisibility) {
        public boolean badgesHidden() {
            return "OFF".equals(fanScoreVisibility);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FanScorePage(List<FanScoreTitle> fanScoreTitles, boolean hasNext, int totalCount) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FanScoreTitle(
            long id,
            String subject,
            String thumbnailUrl,
            String titleBannerBackgroundColor,
            double score,
            String fanStatus,
            boolean adult
    ) {
    }
}
