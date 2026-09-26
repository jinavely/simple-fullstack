package jinavely.github.io.fullstack.post.repository;

import jinavely.github.io.fullstack.post.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {

    Optional<Post> findByIdAndHiddenFalse(Long id);

    @EntityGraph(attributePaths = "user")
    @Query("""
            select p from Post p
            where p.hidden = false
              and (:keyword is null
                   or p.title like concat('%', :keyword, '%')
                   or p.content like concat('%', :keyword, '%'))
            """)
    Page<Post> search(@Param("keyword") String keyword, Pageable pageable);
}