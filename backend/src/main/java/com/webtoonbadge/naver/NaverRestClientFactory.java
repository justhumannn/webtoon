package com.webtoonbadge.naver;

import java.net.http.HttpClient;

import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.webtoonbadge.config.AppProperties;

/** 네이버 호출용 RestClient 설정(주소, 타임아웃, User-Agent)을 한곳에 모은다. 테스트에서는 이 빌더에 목 서버를 붙인다. */
@Component
public class NaverRestClientFactory {

    private final AppProperties.Naver props;

    public NaverRestClientFactory(AppProperties appProperties) {
        this.props = appProperties.naver();
    }

    public RestClient.Builder builder() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(props.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(props.readTimeout());
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent());
    }

    public RestClient create() {
        return builder().build();
    }
}
