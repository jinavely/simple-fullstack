package jinavely.github.io.fullstack;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class FullstackApplicationTests {

	@Test
	void contextLoads() {
	}

}
