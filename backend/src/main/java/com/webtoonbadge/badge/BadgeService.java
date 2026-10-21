package com.webtoonbadge.badge;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.webtoonbadge.common.ApiException;
import com.webtoonbadge.config.AppProperties;
import com.webtoonbadge.naver.NaverDtos.CreatorResult;
import com.webtoonbadge.naver.NaverDtos.FanScoreTitle;
import com.webtoonbadge.naver.NaverWebtoonClient;
import com.webtoonbadge.naver.NaverWebtoonClient.FanScoreList;

@Service
public class BadgeService {

    /** 네이버로 동시에 나가는 배지 조회 수 제한 (네이버 서버 부담 최소화) */
    private static final int MAX_CONCURRENT_FETCHES = 3;
    private static final Pattern HEX_COLOR = Pattern.compile("^[0-9a-fA-F]{6}$");

    private final NaverWebtoonClient client;
    private final Clock clock;
    private final Semaphore fetchPermits = new Semaphore(MAX_CONCURRENT_FETCHES);
    /** 썸네일 이미지는 저장하지 않고, 배지 목록(텍스트 정보)만 짧게 캐시한다. */
    private final Cache<String, Snapshot> cache;

    public BadgeService(NaverWebtoonClient client, AppProperties props, Clock clock) {
        this.client = client;
        this.clock = clock;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(props.cache().ttl())
                .maximumSize(props.cache().maxSize())
                .build();
    }

    public BadgeListResponse getBadges(String link, boolean includeAdult) {
        String handle = BadgeLinkParser.parseHandle(link);
        Snapshot snapshot = cache.get(handle.toLowerCase(Locale.ROOT), key -> load(handle));

        boolean adultAllowed = includeAdult && !snapshot.adultPrivate();
        List<FanScoreTitle> visible = snapshot.titles().stream()
                .filter(t -> adultAllowed || !t.adult())
                .toList();
        int hiddenAdult = snapshot.titles().size() - visible.size();

        List<BadgeListResponse.Badge> badges = visible.stream().map(BadgeService::toBadge).toList();
        return new BadgeListResponse(
                snapshot.profile(),
                Math.max(0, snapshot.totalCount() - hiddenAdult),
                hiddenAdult,
                badges,
                snapshot.fetchedAt());
    }

    private Snapshot load(String handle) {
        boolean acquired;
        try {
            acquired = fetchPermits.tryAcquire(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.upstream("요청이 중단됐어요.");
        }
        if (!acquired) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BUSY", "요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.");
        }
        try {
            CreatorResult creatorResult = client.fetchCreator(handle);
            var creator = creatorResult.creator();
            if (creatorResult.settings() != null && creatorResult.settings().badgesHidden()) {
                throw ApiException.badgesHidden();
            }
            boolean adultPrivate = creatorResult.settings() != null
                    && "ADULT_PRIVATE".equals(creatorResult.settings().fanScoreVisibility());

            FanScoreList list = client.fetchAllFanScoreTitles(creator.creatorId());
            String profileUrl = creator.profileUrl() != null ? creator.profileUrl() : handle;
            String profileImage = creator.profileImage() != null ? creator.profileImage().toUrl() : null;
            var profile = new BadgeListResponse.Profile(
                    profileUrl,
                    creator.nickname(),
                    profileImage != null ? proxied(profileImage) : null,
                    "https://comic.naver.com/community/u/" + profileUrl + "/badge");
            return new Snapshot(profile, list.titles(), list.totalCount(), adultPrivate, Instant.now(clock));
        } finally {
            fetchPermits.release();
        }
    }

    private static BadgeListResponse.Badge toBadge(FanScoreTitle t) {
        String color = t.titleBannerBackgroundColor() != null && HEX_COLOR.matcher(t.titleBannerBackgroundColor()).matches()
                ? "#" + t.titleBannerBackgroundColor().toLowerCase(Locale.ROOT)
                : null;
        return new BadgeListResponse.Badge(
                t.id(),
                t.subject(),
                t.thumbnailUrl() != null ? proxied(t.thumbnailUrl()) : null,
                t.thumbnailUrl(),
                color,
                t.score(),
                t.adult(),
                "https://comic.naver.com/webtoon/list?titleId=" + t.id());
    }

    static String proxied(String sourceUrl) {
        return "/api/image?src=" + URLEncoder.encode(sourceUrl, StandardCharsets.UTF_8);
    }

    private record Snapshot(
            BadgeListResponse.Profile profile,
            List<FanScoreTitle> titles,
            int totalCount,
            boolean adultPrivate,
            Instant fetchedAt
    ) {
    }
}
