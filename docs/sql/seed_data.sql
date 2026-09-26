-- 샘플 데이터 (테이블당 5건)
-- 순서: users -> upload_files -> posts -> post_files -> comments -> refresh_tokens -> users 프로필 연결
-- ID를 1~5로 직접 지정해서 FK 관계를 알아보기 쉽게 했음

-- ------------------------------------------------------------
-- 1. users (profile_file_id는 아직 NULL, 맨 마지막에 UPDATE)
--    password는 샘플 BCrypt 해시. 실제 로그인 테스트는 아래 안내 참고
-- ------------------------------------------------------------
INSERT INTO users (id, login_id, password, nickname, email, role, status, profile_file_id, last_login_at, created_at, updated_at, deleted_at) VALUES
(1, 'boris',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '보리스',   'boris@example.com',   'USER',  'ACTIVE',    NULL, '2026-09-20 10:00:00', '2026-09-01 09:00:00', '2026-09-01 09:00:00', NULL),
(2, 'minji',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '민지',     'minji@example.com',   'USER',  'ACTIVE',    NULL, '2026-09-21 14:30:00', '2026-09-02 11:20:00', '2026-09-02 11:20:00', NULL),
(3, 'junho',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '준호',     'junho@example.com',   'USER',  'ACTIVE',    NULL, '2026-09-19 08:15:00', '2026-09-03 15:40:00', '2026-09-03 15:40:00', NULL),
(4, 'sora',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '소라',     'sora@example.com',    'USER',  'SUSPENDED', NULL, '2026-09-10 21:00:00', '2026-09-05 18:10:00', '2026-09-15 09:00:00', NULL),
(5, 'admin',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '관리자',   'admin@example.com',   'ADMIN', 'ACTIVE',    NULL, '2026-09-22 09:00:00', '2026-09-01 08:00:00', '2026-09-01 08:00:00', NULL);

-- ------------------------------------------------------------
-- 2. upload_files
-- ------------------------------------------------------------
INSERT INTO upload_files (id, user_id, original_name, stored_name, extension, content_type, file_size, thumbnail_name, created_at, updated_at, deleted_at) VALUES
(1, 1, '프로필사진.jpg',  '3f2b9c1e-1a2b-4c3d-8e9f-000000000001.jpg', 'jpg',  'image/jpeg',       204800, 's_3f2b9c1e-1a2b-4c3d-8e9f-000000000001.jpg', '2026-09-10 10:00:00', '2026-09-10 10:00:00', NULL),
(2, 1, '화면설계.png',    '3f2b9c1e-1a2b-4c3d-8e9f-000000000002.png', 'png',  'image/png',        512000, 's_3f2b9c1e-1a2b-4c3d-8e9f-000000000002.png', '2026-09-10 10:05:00', '2026-09-10 10:05:00', NULL),
(3, 2, '회의록.pdf',      '3f2b9c1e-1a2b-4c3d-8e9f-000000000003.pdf', 'pdf',  'application/pdf', 1048576, NULL,                                          '2026-09-11 13:00:00', '2026-09-11 13:00:00', NULL),
(4, 3, '일정표.xlsx',     '3f2b9c1e-1a2b-4c3d-8e9f-000000000004.xlsx','xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 30720, NULL, '2026-09-12 09:30:00', '2026-09-12 09:30:00', NULL),
(5, 5, '공지배너.jpg',    '3f2b9c1e-1a2b-4c3d-8e9f-000000000005.jpg', 'jpg',  'image/jpeg',       307200, 's_3f2b9c1e-1a2b-4c3d-8e9f-000000000005.jpg', '2026-09-13 17:00:00', '2026-09-13 17:00:00', NULL);

-- ------------------------------------------------------------
-- 3. posts (4번은 삭제된 글, 5번은 관리자 공지)
-- ------------------------------------------------------------
INSERT INTO posts (id, user_id, title, content, view_count, hidden, created_at, updated_at, deleted_at) VALUES
(1, 1, '첫 번째 게시글입니다',       '게시판 오픈 기념 첫 글입니다. 첨부 이미지 확인해 주세요.', 42, FALSE, '2026-09-10 10:10:00', '2026-09-10 10:10:00', NULL),
(2, 2, '주간 회의록 공유',           '이번 주 회의록 PDF 첨부합니다.',                            17, FALSE, '2026-09-11 13:05:00', '2026-09-11 13:05:00', NULL),
(3, 3, '10월 일정표',                '10월 일정 정리했습니다. 엑셀 파일 참고하세요.',            8,  FALSE, '2026-09-12 09:35:00', '2026-09-12 11:00:00', NULL),
(4, 4, '삭제된 게시글',              '이 글은 삭제 처리된 테스트용 글입니다.',                    3,  FALSE, '2026-09-14 20:00:00', '2026-09-14 20:30:00', '2026-09-14 20:30:00'),
(5, 5, '[공지] 게시판 이용 안내',    '게시판 이용 규칙을 안내드립니다.',                          120, FALSE, '2026-09-13 17:05:00', '2026-09-13 17:05:00', NULL);

-- ------------------------------------------------------------
-- 4. post_files (1번 글에 첨부 2개)
-- ------------------------------------------------------------
INSERT INTO post_files (id, post_id, file_id, sort_order, created_at) VALUES
(1, 1, 1, 0, '2026-09-10 10:10:00'),
(2, 1, 2, 1, '2026-09-10 10:10:00'),
(3, 2, 3, 0, '2026-09-11 13:05:00'),
(4, 3, 4, 0, '2026-09-12 09:35:00'),
(5, 5, 5, 0, '2026-09-13 17:05:00');

-- ------------------------------------------------------------
-- 5. comments (5번은 삭제된 댓글)
-- ------------------------------------------------------------
INSERT INTO comments (id, post_id, user_id, content, created_at, updated_at, deleted_at) VALUES
(1, 1, 2, '축하합니다! 첫 글 잘 봤어요.',       '2026-09-10 11:00:00', '2026-09-10 11:00:00', NULL),
(2, 1, 3, '이미지 잘 보이네요.',                '2026-09-10 12:30:00', '2026-09-10 12:30:00', NULL),
(3, 2, 1, '회의록 감사합니다.',                 '2026-09-11 14:00:00', '2026-09-11 14:00:00', NULL),
(4, 5, 2, '공지 확인했습니다.',                 '2026-09-13 18:00:00', '2026-09-13 18:00:00', NULL),
(5, 3, 4, '삭제된 댓글입니다.',                 '2026-09-12 10:00:00', '2026-09-12 10:20:00', '2026-09-12 10:20:00');

-- ------------------------------------------------------------
-- 6. refresh_tokens (token_hash는 SHA2 함수로 64자리 생성)
--    4번은 폐기(로그아웃), 5번은 만료된 토큰
-- ------------------------------------------------------------
INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, expires_at, revoked_at, created_at) VALUES
(1, 1, SHA2('sample-refresh-token-1', 256), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0', '2026-10-04 10:00:00', NULL,                  '2026-09-20 10:00:00'),
(2, 2, SHA2('sample-refresh-token-2', 256), 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1',  '2026-10-05 14:30:00', NULL,                  '2026-09-21 14:30:00'),
(3, 3, SHA2('sample-refresh-token-3', 256), 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/128.0', '2026-10-03 08:15:00', NULL,               '2026-09-19 08:15:00'),
(4, 1, SHA2('sample-refresh-token-4', 256), 'Mozilla/5.0 (Linux; Android 15) Chrome/128.0',          '2026-09-30 09:00:00', '2026-09-16 18:00:00', '2026-09-16 09:00:00'),
(5, 5, SHA2('sample-refresh-token-5', 256), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/128.0',  '2026-09-15 09:00:00', NULL,                  '2026-09-01 09:00:00');

-- ------------------------------------------------------------
-- 7. users 프로필 이미지 연결 (upload_files가 들어간 뒤에 해야 FK 통과)
-- ------------------------------------------------------------
UPDATE users SET profile_file_id = 1 WHERE id = 1;

-- 확인용
-- SELECT * FROM users;
-- SELECT p.id, p.title, u.nickname, COUNT(pf.id) AS file_cnt
--   FROM posts p JOIN users u ON u.id = p.user_id
--   LEFT JOIN post_files pf ON pf.post_id = p.id
--  GROUP BY p.id;
