package com.webtoonbadge.image;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.webtoonbadge.common.ApiException;
import com.webtoonbadge.config.AppProperties;

/**
 * 네이버 썸네일은 CORS 헤더가 없어서 브라우저가 canvas 로 이미지를 만들 수 없다.
 * 그래서 허용된 네이버 이미지 도메인만 대신 받아서 그대로 전달한다. 서버에 저장하지 않는다.
 */
@RestController
public class ImageProxyController {

    private final HttpClient httpClient;
    private final AppProperties.Naver naver;
    private final List<String> allowedDomains;
    private final long maxBytes;

    public ImageProxyController(AppProperties props) {
        this.naver = props.naver();
        this.allowedDomains = props.imageProxy().allowedDomains().stream()
                .map(d -> d.toLowerCase(Locale.ROOT))
                .toList();
        this.maxBytes = props.imageProxy().maxBytes();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(naver.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @GetMapping("/api/image")
    public ResponseEntity<byte[]> proxy(@RequestParam("src") String src) {
        URI uri = validate(src);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(naver.readTimeout())
                .header(HttpHeaders.USER_AGENT, naver.userAgent())
                .header(HttpHeaders.ACCEPT, "image/*")
                .GET()
                .build();

        HttpResponse<InputStream> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            throw ApiException.upstream("이미지를 가져오지 못했어요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.upstream("이미지 요청이 중단됐어요.");
        }

        try (InputStream body = response.body()) {
            if (response.statusCode() != 200) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "IMAGE_UNAVAILABLE", "이미지를 찾을 수 없어요.");
            }
            String contentType = response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse("");
            if (!contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "NOT_AN_IMAGE", "이미지가 아닌 응답이에요.");
            }
            byte[] bytes = body.readNBytes((int) maxBytes + 1);
            if (bytes.length > maxBytes) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "IMAGE_TOO_LARGE", "이미지가 너무 커요.");
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                    .header("X-Content-Type-Options", "nosniff")
                    .body(bytes);
        } catch (IOException e) {
            throw ApiException.upstream("이미지를 읽지 못했어요.");
        }
    }

    URI validate(String src) {
        URI uri;
        try {
            uri = URI.create(src.strip());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("이미지 주소 형식이 올바르지 않아요.");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean allowedHost = allowedDomains.stream().anyMatch(d -> host.equals(d) || host.endsWith("." + d));
        boolean ok = "https".equalsIgnoreCase(uri.getScheme())
                && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && allowedHost;
        if (!ok) {
            throw ApiException.badRequest("허용되지 않은 이미지 주소예요.");
        }
        return uri;
    }
}
