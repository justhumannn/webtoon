package com.webtoonbadge.naver;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.webtoonbadge.common.ApiException;
import com.webtoonbadge.config.AppProperties;
import com.webtoonbadge.naver.NaverDtos.CreatorResult;
import com.webtoonbadge.naver.NaverDtos.Envelope;
import com.webtoonbadge.naver.NaverDtos.FanScorePage;
import com.webtoonbadge.naver.NaverDtos.FanScoreTitle;

/**
 * 네이버웹툰 커뮤니티 웹이 쓰는 API를 호출한다.
 * 네이버 서버 부담을 줄이려고 페이지는 순서대로, 요청 사이에 간격을 두고 가져온다.
 */
@Component
public class NaverWebtoonClient {

    private static final Logger log = LoggerFactory.getLogger(NaverWebtoonClient.class);

    private static final ParameterizedTypeReference<Envelope<CreatorResult>> CREATOR_TYPE =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<Envelope<FanScorePage>> FAN_SCORE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    private final RestClient restClient;
    private final AppProperties.Naver props;

    @Autowired
    public NaverWebtoonClient(NaverRestClientFactory factory, AppProperties appProperties) {
        this(factory.create(), appProperties.naver());
    }

    NaverWebtoonClient(RestClient restClient, AppProperties.Naver props) {
        this.restClient = restClient;
        this.props = props;
    }

    public CreatorResult fetchCreator(String handle) {
        Envelope<CreatorResult> body;
        try {
            body = restClient.get()
                    .uri("/v1/creator/profile-url/{handle}", handle)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(CREATOR_TYPE);
        } catch (HttpClientErrorException.NotFound e) {
            throw ApiException.userNotFound();
        } catch (RestClientException e) {
            log.warn("creator lookup failed handle={}: {}", handle, e.getMessage());
            throw ApiException.upstream("네이버웹툰에서 프로필 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
        if (body == null || !body.isSuccess() || body.result() == null || body.result().creator() == null) {
            throw ApiException.userNotFound();
        }
        return body.result();
    }

    /** 모든 찐팬 배지를 가져온다. totalCount 는 네이버가 알려준 전체 개수. */
    public FanScoreList fetchAllFanScoreTitles(String creatorId) {
        List<FanScoreTitle> all = new ArrayList<>();
        int totalCount = 0;
        for (int page = 0; page < props.maxPages(); page++) {
            if (page > 0) {
                sleep();
            }
            FanScorePage result = fetchFanScorePage(creatorId, all.size());
            totalCount = result.totalCount();
            if (result.fanScoreTitles() != null) {
                all.addAll(result.fanScoreTitles());
            }
            if (!result.hasNext() || result.fanScoreTitles() == null || result.fanScoreTitles().isEmpty()) {
                break;
            }
        }
        return new FanScoreList(all, Math.max(totalCount, all.size()));
    }

    FanScorePage fetchFanScorePage(String creatorId, int offset) {
        Envelope<FanScorePage> body;
        try {
            body = restClient.get()
                    .uri(b -> b.path("/v1/home-pages/{creatorId}/fan-score-titles")
                            .queryParam("type", "FAN")
                            .queryParam("offset", offset)
                            .queryParam("limit", props.pageSize())
                            .build(creatorId))
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(FAN_SCORE_TYPE);
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.FORBIDDEN) {
                throw ApiException.badgesHidden();
            }
            log.warn("fan score fetch failed creatorId={} offset={}: {}", creatorId, offset, e.getMessage());
            throw ApiException.upstream("네이버웹툰에서 배지 목록을 가져오지 못했어요.");
        } catch (RestClientException e) {
            log.warn("fan score fetch failed creatorId={} offset={}: {}", creatorId, offset, e.getMessage());
            throw ApiException.upstream("네이버웹툰에서 배지 목록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
        if (body == null || !body.isSuccess() || body.result() == null) {
            throw ApiException.upstream("네이버웹툰 응답 형식이 예상과 달라요.");
        }
        return body.result();
    }

    private void sleep() {
        try {
            Thread.sleep(props.pageDelay());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.upstream("요청이 중단됐어요.");
        }
    }

    public record FanScoreList(List<FanScoreTitle> titles, int totalCount) {
    }
}
