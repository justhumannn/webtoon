package com.webtoonbadge.badge;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.webtoonbadge.common.ApiException;

/**
 * 사용자가 붙여넣은 값에서 커뮤니티 핸들을 꺼낸다.
 * 허용: https://comic.naver.com/community/u/{handle}/badge, m.comic.naver.com, 프로필 주소, "@handle", "handle"
 */
public final class BadgeLinkParser {

    private static final String HANDLE = "[A-Za-z0-9._-]{1,64}";
    private static final Pattern URL = Pattern.compile(
            "^(?:https?://)?(?:m\\.)?comic\\.naver\\.com/community/u/(" + HANDLE + ")(?:/[^?#]*)?(?:[?#].*)?$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern BARE = Pattern.compile("^@?(" + HANDLE + ")$");

    private BadgeLinkParser() {
    }

    public static String parseHandle(String input) {
        if (input == null || input.isBlank()) {
            throw ApiException.badRequest("배지 페이지 링크를 입력해 주세요.");
        }
        String value = input.strip();
        Matcher url = URL.matcher(value);
        if (url.matches()) {
            return url.group(1);
        }
        if (!value.contains("/") && !value.contains(".")) {
            Matcher bare = BARE.matcher(value);
            if (bare.matches()) {
                return bare.group(1);
            }
        }
        throw ApiException.badRequest("네이버웹툰 배지 페이지 링크가 아니에요. 예: https://comic.naver.com/community/u/아이디/badge");
    }
}
