package jinavely.github.io.fullstack.global.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import jinavely.github.io.fullstack.global.error.ErrorCode;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        T data,
        ErrorBody error
) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static ApiResponse<Void> fail(ErrorCode code) {
        return new ApiResponse<>(false, null,
                new ErrorBody(code.getCode(), code.getMessage(), null));
    }

    public static ApiResponse<Void> fail(ErrorCode code, Map<String, String> fields) {
        return new ApiResponse<>(false, null,
                new ErrorBody(code.getCode(), code.getMessage(), fields));
    }

    public record ErrorBody(String code, String message, Map<String, String> fields) {
    }
}