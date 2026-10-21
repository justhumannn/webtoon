package com.webtoonbadge.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.webtoonbadge.common.ApiException;
import com.webtoonbadge.config.AppProperties;

class ImageProxyControllerTest {

    private final ImageProxyController controller = new ImageProxyController(new AppProperties(
            new AppProperties.Cors(List.of("http://localhost:3000")),
            new AppProperties.Naver("https://comic.naver.com/community/api", "ua", Duration.ofSeconds(1),
                    Duration.ofSeconds(1), 30, 10, Duration.ZERO),
            new AppProperties.Cache(Duration.ofMinutes(1), 10),
            new AppProperties.RateLimit(10, 10),
            new AppProperties.ImageProxy(List.of("pstatic.net"), 1024)));

    @ParameterizedTest
    @ValueSource(strings = {
            "https://shared-comic.pstatic.net/thumb/webtoon/1/thumbnail/a.jpg",
            "https://pstatic.net/a.png",
    })
    void allowsNaverImageHosts(String src) {
        assertThat(controller.validate(src).getHost()).endsWith("pstatic.net");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://shared-comic.pstatic.net/a.jpg",
            "https://evilpstatic.net/a.jpg",
            "https://pstatic.net.evil.com/a.jpg",
            "https://user@shared-comic.pstatic.net/a.jpg",
            "https://shared-comic.pstatic.net:8443/a.jpg",
            "https://localhost/a.jpg",
            "file:///etc/passwd",
            "not a url",
    })
    void rejectsEverythingElse(String src) {
        assertThatThrownBy(() -> controller.validate(src)).isInstanceOf(ApiException.class);
    }
}
