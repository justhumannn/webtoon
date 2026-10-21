package com.webtoonbadge.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", message);
    }

    public static ApiException userNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "해당 사용자를 찾을 수 없어요. 링크를 다시 확인해 주세요.");
    }

    public static ApiException badgesHidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "BADGES_HIDDEN", "이 사용자는 찐팬 배지를 공개하지 않았어요.");
    }

    public static ApiException upstream(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", message);
    }
}
