-- ============================================================
-- simple-fullstack 게시판 스키마
-- DB: MySQL 8.4, utf8mb4 / utf8mb4_0900_ai_ci
-- ============================================================

CREATE TABLE users (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '회원 ID',
    login_id         VARCHAR(20)  NOT NULL                COMMENT '로그인 아이디',
    password         VARCHAR(100) NOT NULL                COMMENT 'BCrypt 해시',
    nickname         VARCHAR(20)  NOT NULL                COMMENT '닉네임',
    email            VARCHAR(100) NOT NULL                COMMENT '이메일',
    role             VARCHAR(20)  NOT NULL DEFAULT 'USER'   COMMENT '권한: USER, ADMIN',
    status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' COMMENT '상태: ACTIVE, SUSPENDED, WITHDRAWN',
    profile_file_id  BIGINT       NULL                    COMMENT '프로필 이미지 파일 ID',
    last_login_at    DATETIME(6)  NULL                    COMMENT '마지막 로그인 일시',
    created_at       DATETIME(6)  NOT NULL                COMMENT '가입 일시',
    updated_at       DATETIME(6)  NOT NULL                COMMENT '수정 일시',
    deleted_at       DATETIME(6)  NULL                    COMMENT '탈퇴 일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_login_id (login_id),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_status_created (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '회원';

CREATE TABLE upload_files (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '파일 ID',
    user_id          BIGINT       NOT NULL                COMMENT '업로드한 회원 ID',
    original_name    VARCHAR(255) NOT NULL                COMMENT '원래 파일명',
    stored_name      VARCHAR(100) NOT NULL                COMMENT '서버 저장 파일명 (UUID)',
    extension        VARCHAR(10)  NOT NULL                COMMENT '확장자',
    content_type     VARCHAR(100) NOT NULL                COMMENT 'MIME 타입',
    file_size        BIGINT       NOT NULL                COMMENT '파일 크기 (byte)',
    thumbnail_name   VARCHAR(100) NULL                    COMMENT '썸네일 파일명',
    created_at       DATETIME(6)  NOT NULL                COMMENT '업로드 일시',
    updated_at       DATETIME(6)  NOT NULL                COMMENT '수정 일시',
    deleted_at       DATETIME(6)  NULL                    COMMENT '삭제 일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_upload_files_stored_name (stored_name),
    KEY idx_upload_files_user_created (user_id, created_at),
    CONSTRAINT fk_upload_files_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '업로드 파일';

CREATE TABLE posts (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '게시글 ID',
    user_id          BIGINT       NOT NULL                COMMENT '작성자 회원 ID',
    title            VARCHAR(200) NOT NULL                COMMENT '제목',
    content          TEXT         NOT NULL                COMMENT '본문',
    view_count       INT          NOT NULL DEFAULT 0      COMMENT '조회수',
    hidden           BOOLEAN      NOT NULL DEFAULT FALSE  COMMENT '관리자 숨김 여부',
    created_at       DATETIME(6)  NOT NULL                COMMENT '작성 일시',
    updated_at       DATETIME(6)  NOT NULL                COMMENT '수정 일시',
    deleted_at       DATETIME(6)  NULL                    COMMENT '삭제 일시',
    PRIMARY KEY (id),
    KEY idx_posts_created (created_at),
    KEY idx_posts_user_created (user_id, created_at),
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '게시글';

CREATE TABLE post_files (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'ID',
    post_id          BIGINT       NOT NULL                COMMENT '게시글 ID',
    file_id          BIGINT       NOT NULL                COMMENT '파일 ID',
    sort_order       INT          NOT NULL DEFAULT 0      COMMENT '첨부 순서',
    created_at       DATETIME(6)  NOT NULL                COMMENT '등록 일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_post_files (post_id, file_id),
    KEY idx_post_files_file (file_id),
    CONSTRAINT fk_post_files_post FOREIGN KEY (post_id) REFERENCES posts (id),
    CONSTRAINT fk_post_files_file FOREIGN KEY (file_id) REFERENCES upload_files (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '게시글 첨부파일';

CREATE TABLE comments (
    id               BIGINT        NOT NULL AUTO_INCREMENT COMMENT '댓글 ID',
    post_id          BIGINT        NOT NULL                COMMENT '게시글 ID',
    user_id          BIGINT        NOT NULL                COMMENT '작성자 회원 ID',
    content          VARCHAR(1000) NOT NULL                COMMENT '댓글 내용',
    created_at       DATETIME(6)   NOT NULL                COMMENT '작성 일시',
    updated_at       DATETIME(6)   NOT NULL                COMMENT '수정 일시',
    deleted_at       DATETIME(6)   NULL                    COMMENT '삭제 일시',
    PRIMARY KEY (id),
    KEY idx_comments_post_created (post_id, created_at),
    KEY idx_comments_user (user_id),
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id),
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '댓글';

CREATE TABLE refresh_tokens (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '토큰 ID',
    user_id          BIGINT       NOT NULL                COMMENT '회원 ID',
    token_hash       CHAR(64)     NOT NULL                COMMENT '토큰의 SHA-256 해시',
    user_agent       VARCHAR(255) NULL                    COMMENT '로그인 기기 정보',
    expires_at       DATETIME(6)  NOT NULL                COMMENT '만료 일시',
    revoked_at       DATETIME(6)  NULL                    COMMENT '폐기 일시',
    created_at       DATETIME(6)  NOT NULL                COMMENT '발급 일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user (user_id),
    KEY idx_refresh_tokens_expires (expires_at),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '리프레시 토큰';
