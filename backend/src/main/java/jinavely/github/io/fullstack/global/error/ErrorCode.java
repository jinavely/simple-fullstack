package jinavely.github.io.fullstack.global.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 공통 (C)
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "입력값이 올바르지 않습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C999", "서버 오류가 발생했습니다."),

    // 회원 (U)
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "회원을 찾을 수 없습니다."),

    // 게시글 (P)
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "P001", "게시글을 찾을 수 없습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}