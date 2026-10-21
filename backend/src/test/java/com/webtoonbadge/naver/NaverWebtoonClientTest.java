package com.webtoonbadge.naver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.webtoonbadge.common.ApiException;
import com.webtoonbadge.config.AppProperties;

class NaverWebtoonClientTest {

    private static final String BASE = "https://comic.naver.com/community/api";

    private MockRestServiceServer server;
    private NaverWebtoonClient client;

    @BeforeEach
    void setUp() {
        var props = new AppProperties.Naver(BASE, "test-agent", Duration.ofSeconds(1), Duration.ofSeconds(1),
                2, 10, Duration.ZERO);
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new NaverWebtoonClient(builder.build(), props);
    }

    @Test
    void fetchesAllPagesUsingOffset() {
        server.expect(requestTo(BASE + "/v1/home-pages/abc/fan-score-titles?type=FAN&offset=0&limit=2"))
                .andRespond(withSuccess(page("[" + title(1) + "," + title(2) + "]", true, 3), MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/v1/home-pages/abc/fan-score-titles?type=FAN&offset=2&limit=2"))
                .andRespond(withSuccess(page("[" + title(3) + "]", false, 3), MediaType.APPLICATION_JSON));

        var result = client.fetchAllFanScoreTitles("abc");

        assertThat(result.totalCount()).isEqualTo(3);
        assertThat(result.titles()).extracting(NaverDtos.FanScoreTitle::id).containsExactly(1L, 2L, 3L);
        assertThat(result.titles().getFirst().titleBannerBackgroundColor()).isEqualTo("4979b9");
        server.verify();
    }

    @Test
    void readsCreatorAndProfileImage() {
        server.expect(requestTo(BASE + "/v1/creator/profile-url/just"))
                .andRespond(withSuccess("""
                        {"status":"success","result":{"creator":{"creatorId":"re8gx","profileUrl":"just","nickname":"걍사람",
                        "profileImage":{"domain":"https://a.pstatic.net","path":"/p.png"},"extra":1},
                        "settings":{"fanScoreVisibility":"ADULT_PRIVATE"}}}
                        """, MediaType.APPLICATION_JSON));

        var result = client.fetchCreator("just");

        assertThat(result.creator().creatorId()).isEqualTo("re8gx");
        assertThat(result.creator().profileImage().toUrl()).isEqualTo("https://a.pstatic.net/p.png");
        assertThat(result.settings().badgesHidden()).isFalse();
    }

    @Test
    void mapsNotFoundToUserNotFound() {
        server.expect(requestTo(BASE + "/v1/creator/profile-url/nobody"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"status\":\"fail\",\"error\":{\"typeMessage\":\"E404_NOT_FOUND_CREATOR\"}}"));

        assertThatThrownBy(() -> client.fetchCreator("nobody"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("USER_NOT_FOUND"));
    }

    private static String page(String titles, boolean hasNext, int total) {
        return "{\"status\":\"success\",\"result\":{\"fanScoreTitles\":" + titles
                + ",\"hasNext\":" + hasNext + ",\"totalCount\":" + total + "}}";
    }

    private static String title(long id) {
        return "{\"id\":" + id + ",\"subject\":\"작품" + id + "\",\"thumbnailUrl\":\"https://shared-comic.pstatic.net/t" + id
                + ".jpg\",\"titleBannerBackgroundColor\":\"4979b9\",\"score\":99.9,\"fanStatus\":\"FAN\",\"adult\":false}";
    }
}
