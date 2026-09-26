package jinavely.github.io.fullstack.post.dto;

import jinavely.github.io.fullstack.post.entity.Post;

import java.time.LocalDateTime;

public record PostResponse(
        Long id,
        Long writerId,
        String writerNickname,
        String title,
        String content,
        int viewCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PostResponse from(Post post) {
        return new PostResponse(
                post.getId(),
                post.getUser().getId(),
                post.getUser().getNickname(),
                post.getTitle(),
                post.getContent(),
                post.getViewCount(),
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }
}