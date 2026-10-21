package com.webtoonbadge.badge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.webtoonbadge.common.ApiException;

class BadgeLinkParserTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://comic.naver.com/community/u/just/badge",
            "https://comic.naver.com/community/u/just",
            "http://m.comic.naver.com/community/u/just/badge?tab=fan",
            "comic.naver.com/community/u/just/badge",
            "  https://comic.naver.com/community/u/just/badge#top  ",
            "just",
            "@just",
    })
    void extractsHandle(String input) {
        assertThat(BadgeLinkParser.parseHandle(input)).isEqualTo("just");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "https://example.com/community/u/just/badge",
            "https://comic.naver.com/webtoon/list?titleId=1",
            "https://evil.comic.naver.com.attacker.io/community/u/just",
            "ju st",
    })
    void rejectsOtherInputs(String input) {
        assertThatThrownBy(() -> BadgeLinkParser.parseHandle(input)).isInstanceOf(ApiException.class);
    }
}
