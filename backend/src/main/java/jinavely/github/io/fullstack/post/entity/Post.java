package jinavely.github.io.fullstack.post.entity;

import jakarta.persistence.*;
import jinavely.github.io.fullstack.global.common.BaseTimeEntity;
import jinavely.github.io.fullstack.user.entity.User;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

@Entity
@Table(name = "posts")
@SQLRestriction("deleted_at IS NULL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private int viewCount;

    @Column(nullable = false)
    private boolean hidden;

    private LocalDateTime deletedAt;

    @Builder
    private Post(User user, String title, String content) {
        this.user = user;
        this.title = title;
        this.content = content;
        this.viewCount = 0;
        this.hidden = false;
    }

    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    public void increaseViewCount() {
        this.viewCount++;
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }
}