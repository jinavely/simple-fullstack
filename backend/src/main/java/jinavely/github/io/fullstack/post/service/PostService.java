package jinavely.github.io.fullstack.post.service;

import jinavely.github.io.fullstack.global.common.PageResponse;
import jinavely.github.io.fullstack.global.error.BusinessException;
import jinavely.github.io.fullstack.global.error.ErrorCode;
import jinavely.github.io.fullstack.post.dto.PostCreateRequest;
import jinavely.github.io.fullstack.post.dto.PostResponse;
import jinavely.github.io.fullstack.post.dto.PostUpdateRequest;
import jinavely.github.io.fullstack.post.entity.Post;
import jinavely.github.io.fullstack.post.repository.PostRepository;
import jinavely.github.io.fullstack.user.entity.User;
import jinavely.github.io.fullstack.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    @Transactional
    public Long create(Long userId, PostCreateRequest req) {
        User writer = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Post saved = postRepository.save(req.toEntity(writer));
        return saved.getId();
    }

    @Transactional
    public PostResponse get(Long id) {
        Post post = findPost(id);
        post.increaseViewCount();
        return PostResponse.from(post);
    }

    private Post findPost(Long id) {
        return postRepository.findByIdAndHiddenFalse(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
    }

    public PageResponse<PostResponse> getList(String keyword, Pageable pageable) {
        String searchKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        Page<Post> posts = postRepository.search(searchKeyword, pageable);

        return PageResponse.from(posts.map(PostResponse::from));
    }

    @Transactional
    public Long update(Long id, PostUpdateRequest req) {
        Post post = findPost(id);
        post.update(req.title(), req.content());
        return post.getId();
    }

    @Transactional
    public void delete(Long id) {
        Post post = findPost(id);
        post.delete();   // 소프트 삭제: deleted_at만 기록
    }
}