package jinavely.github.io.fullstack.post.controller;

import jakarta.validation.Valid;
import jinavely.github.io.fullstack.global.common.ApiResponse;
import jinavely.github.io.fullstack.global.common.PageResponse;
import jinavely.github.io.fullstack.post.dto.PostCreateRequest;
import jinavely.github.io.fullstack.post.dto.PostResponse;
import jinavely.github.io.fullstack.post.dto.PostUpdateRequest;
import jinavely.github.io.fullstack.post.service.PostService;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    // TODO 3주차: 로그인한 사용자 id로 교체 (seed_data.sql의 회원 id에 맞추기)
    private static final Long TEMP_USER_ID = 1L;

    private final PostService postService;

    @PostMapping
    public ResponseEntity<ApiResponse<Long>> create(@Valid @RequestBody PostCreateRequest req) {
        Long id = postService.create(TEMP_USER_ID, req);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok(id));
    }

    @GetMapping("/{id}")
    public ApiResponse<PostResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(postService.get(id));
    }

    @GetMapping
    public ApiResponse<PageResponse<PostResponse>> getList(
            @RequestParam(required = false) String keyword,
            @ParameterObject
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(postService.getList(keyword, pageable));
    }

    @PutMapping("/{id}")
    public ApiResponse<Long> update(@PathVariable Long id,
                                    @Valid @RequestBody PostUpdateRequest req) {
        return ApiResponse.ok(postService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return ApiResponse.ok(null);
    }
}