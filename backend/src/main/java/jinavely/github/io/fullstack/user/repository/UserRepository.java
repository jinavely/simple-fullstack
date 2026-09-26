package jinavely.github.io.fullstack.user.repository;

import jinavely.github.io.fullstack.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}