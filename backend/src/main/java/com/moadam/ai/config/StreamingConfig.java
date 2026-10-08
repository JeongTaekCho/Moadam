package com.moadam.ai.config;

import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class StreamingConfig implements WebMvcConfigurer {
  @Bean
  public ThreadPoolTaskExecutor chatExecutor() {
    var executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(8);
    executor.setThreadNamePrefix("chat-stream-");
    return executor;
  }

  @Override
  public void configureAsyncSupport(AsyncSupportConfigurer config) {
    config.setTaskExecutor(chatExecutor()).setDefaultTimeout(120000);
  }
}
