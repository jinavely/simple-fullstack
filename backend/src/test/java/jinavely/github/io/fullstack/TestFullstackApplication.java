package jinavely.github.io.fullstack;

import org.springframework.boot.SpringApplication;

public class TestFullstackApplication {

	public static void main(String[] args) {
		SpringApplication.from(FullstackApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
