package jinavely.github.io.fullstack.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jinavely.github.io.fullstack.post.entity.Post;
import jinavely.github.io.fullstack.user.entity.User;

public record PostCreateRequest(

        @NotBlank(message = "제목은 필수입니다.")
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")
        String title,

        @NotBlank(message = "내용은 필수입니다.")
        String content
) {
    public Post toEntity(User writer) {
        return Post.builder()
                .user(writer)
                .title(title)
                .content(content)
                .build();
    }
}